import { useEffect, useState } from "react";
import { Form, ActionPanel, Action, showToast, Toast } from "@raycast/api";
import fetch from "node-fetch";
import delay from "delay";
import { models, Model } from "../models";
import open from "open";

type Values = {
  textfield: string;
  textarea: string;
  datepicker: Date;
  checkbox: boolean;
  dropdown: string;
  tokeneditor: string[];
};

export default function RenderForm(props: { token: string; modelName: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [modelName, setModelName] = useState(props.modelName);

  async function handler(values: any) {
    const model = await getModelByName(modelName);

    // filter out empty values
    values = Object.fromEntries(Object.entries(values).filter(([_, v]) => v));
    values = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k.replace(model.name, "").replace("-", ""), v])
    );

    for (const entry of Object.entries(values)) {
      const option = options.filter((option) => option.name === entry[0])[0];

      if (option && option.values && (option.values.type === "number" || option.values.type === "integer")) {
        console.log(option.values.type);
        if (option.values.type === "integer") {
          values[entry[0]] = parseInt(entry[1]);
        }

        if (option.values.type === "number") {
          values[entry[0]] = parseFloat(entry[1]);
        }
      }
    }

    console.log("Submission: ", values);

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${props.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: model.latest_version.id,
        input: values,
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
        console.log("success! ", prediction.output);

        showToast({
          style: Toast.Style.Success,
          title: "Model successfully ran",
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

  function toString(value: any) {
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
        {getEnum(props.option.name).map((value, i) => (
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
