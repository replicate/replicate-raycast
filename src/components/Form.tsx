import { useEffect, useState } from "react";
import { Form, ActionPanel, Action, showToast, Toast, Alert, confirmAlert, showHUD } from "@raycast/api";
import fetch from "node-fetch";
import delay from "delay";
import { models, Model } from "../models";
import open from "open";
import { runAppleScript } from "run-applescript";
import { temporaryFile } from "tempy";
import fs from "fs";

type Values = {
  textfield: string;
  textarea: string;
  datepicker: Date;
  checkbox: boolean;
  dropdown: string;
  tokeneditor: string[];
};

export const copyImage = async (url: string) => {
  /**
   * Thank you to https://twitter.com/kevinbatdorf for this
   * clever way to copy to clipboard.
   */
  const tempFile = temporaryFile({ extension: "png" });
  const { hide } = await showToast(Toast.Style.Animated, "Copying image...");
  const response = await fetch(url);

  if (response.status !== 200) {
    await showHUD(`❗Image copy failed. Server responded with ${response.status}`);
    hide();
    return;
  }
  if (response.body !== null) {
    response.body.pipe(fs.createWriteStream(tempFile));
    await runAppleScript(`tell app "Finder" to set the clipboard to ( POSIX file "${tempFile}" )`);
    await showHUD("✅ Image copied to clipboard!");
    hide();
  }
};

export default function RenderForm(props: { token: string; modelName: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [modelName, setModelName] = useState(props.modelName);

  async function handler(values: Values) {
    const model = (await getModelByName(modelName)) as Model;

    // filter out empty values
    let filteredValues = Object.fromEntries(Object.entries(values).filter(([_, v]) => v));
    filteredValues = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k.replace(model.name, "").replace("-", ""), v])
    );

    for (const entry of Object.entries(filteredValues)) {
      const option = options.filter((option) => option.name === entry[0])[0];

      if (option && option.values && (option.values.type === "number" || option.values.type === "integer")) {
        console.log(option.values.type);
        if (option.values.type === "integer") {
          filteredValues[entry[0]] = parseInt(entry[1]);
        }

        if (option.values.type === "number") {
          filteredValues[entry[0]] = parseFloat(entry[1]);
        }
      }
    }

    console.log("Submission: ", filteredValues);

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${props.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: model.latest_version.id,
        input: filteredValues,
      }),
    });

    const prediction = await response.json();
    return JSON.stringify(prediction);
  }

  async function getModelByName(name: string) {
    const model = models.filter((model) => model.name === name);
    return getModel(model[0].owner, model[0].name);
  }

  async function getModel(owner: string, name: string) {
    const response = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
      method: "GET",
      headers: {
        Authorization: `Token ${props.token}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    console.log(result);
    return result;
  }

  const parseModelInputs = (model: any) => {
    const options = model.latest_version.openapi_schema.components.schemas.Input.properties;

    // convert options to array
    const optionsArray = Object.keys(options).map((key) => {
      const newOptions = options;
      if ("allOf" in options[key]) {
        newOptions[key]["enums"] = model.latest_version.openapi_schema.components.schemas;
      }
      return { name: key, values: newOptions[key] };
    });

    console.log("options now: ", optionsArray);

    return optionsArray;
  };

  const handleSubmit = async (values: Values) => {
    setIsLoading(true);
    let prediction = await handler(values);
    prediction = JSON.parse(prediction);

    console.log(prediction.id);

    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      await delay(1000);
      const response = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        method: "GET",
        headers: {
          Authorization: `Token ${props.token}`,
          "Content-Type": "application/json",
        },
      });
      prediction = await response.json();

      if (response.status !== 200 || prediction.status == "failed") {
        console.log(response);
        showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: `Something went wrong`,
          primaryAction: {
            title: "View Prediction on Replicate",
            onAction: () => {
              open(`https://replicate.com/p/${prediction.id}`);
            },
          },
        });
        return;
      }
      console.log(prediction.logs);

      if (prediction.status === "succeeded") {
        setIsLoading(false);

        const start = new Date(prediction.created_at);
        const end = new Date(prediction.completed_at);

        const differenceInSeconds = (end.getTime() - start.getTime()) / 1000;

        await confirmAlert({
          title: "Prediction Complete",
          message: `Your prediction for '${prediction.input.prompt}' finished in ${differenceInSeconds} seconds. Copy the image to your clipboard?`,
          icon: {
            source: prediction.output[0],
          },
          primaryAction: {
            title: "Copy to Clipboard",
            onAction: () => {
              copyImage(prediction.output[0]);
            },
          },
        });

        showToast({
          style: Toast.Style.Success,
          title: "Model successfully Ran",
          message: prediction.output[0],
          primaryAction: {
            title: "View Image",
            onAction: () => {
              open("raycast://extensions/KevinBatdorf/replicate/replicate");
            },
          },
        });
      }
    }
  };

  function updateForm(modelName: string) {
    getModelByName(modelName).then((model) => {
      const options = parseModelInputs(model);
      setOptions(options.sort((a, b) => (a.values["x-order"] > b.values["x-order"] ? 1 : -1)));
      setModelName(modelName);
    });
  }

  useEffect(() => {
    updateForm(props.modelName);
  }, []);

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      {/* <Form.Description text="Run a model on Replicate" /> */}

      <Form.Dropdown id="dropdown" title="Model" defaultValue={props.modelName} onChange={(e) => updateForm(e)}>
        {models.map((model) => (
          <Form.Dropdown.Item key={model.name} value={model.name} title={model.name} />
        ))}
      </Form.Dropdown>
      <Form.Separator />
      {options.map((option) => {
        return option.values.type == "string" || "integer" || "number" ? (
          RenderFormInput({ option: option, modelName: modelName })
        ) : (
          <Form.Description key={option.name} text={option.name} />
        );
      })}
    </Form>
  );
}

function RenderFormInput(props: { option: any; modelName: string }) {
  function getEnum(optionName: string) {
    return Object.entries(props.option.values.enums).filter((entry) => entry[0] === optionName)[0][1].enum;
  }

  function toString(value: string | number | undefined) {
    if (value == null) {
      return "";
    } else {
      return value.toString();
    }
  }

  return "allOf" in props.option.values ? (
    <>
      <Form.Description key={`description-${props.option.name}-${props.modelName}`} text={props.option.name} />
      <Form.Dropdown
        id={`${props.modelName}-${props.option.name}`}
        defaultValue={toString(props.option.values.default)}
      >
        {getEnum(props.option.name).map((value: string | number, i: number) => (
          <Form.Dropdown.Item key={`${props.option.name}-${i}`} value={toString(value)} title={toString(value)} />
        ))}
      </Form.Dropdown>
    </>
  ) : (
    <>
      <Form.Description key={`description-${props.option.name}`} text={props.option.name} />
      <Form.TextField
        id={`${props.modelName}-${props.option.name}`}
        defaultValue={toString(props.option.values.default)}
        info={props.option.values.description}
      />
    </>
  );
}
