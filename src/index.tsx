import { Form, ActionPanel, Action, showToast, Toast, Detail, getPreferenceValues, List, Grid } from "@raycast/api";
import fetch from "node-fetch";
const delay = require("delay");
import { useEffect, useState } from "react";
import { models, Model } from "./models";
const ogs = require("open-graph-scraper");
const open = require("open");

type Values = {
  textfield: string;
  textarea: string;
  datepicker: Date;
  checkbox: boolean;
  dropdown: string;
  tokeneditor: string[];
};

export default function Command() {
  const { token } = getPreferenceValues();

  return (
    <>
      <List>
        <List.Item
          icon={{
            source:
              "https://user-images.githubusercontent.com/14149230/223854538-71327569-76b5-4f77-903c-edf205569927.png",
          }}
          title="Run a model"
          actions={
            <ActionPanel>
              <Action.Push title="Show Details" target={<RenderForm token={token} modelName={models[0].name} />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={{
            source:
              "https://user-images.githubusercontent.com/14149230/223854538-71327569-76b5-4f77-903c-edf205569927.png",
          }}
          title="View predictions"
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title="Show Details"
                url={"raycast://extensions/KevinBatdorf/replicate/replicate"}
              />
            </ActionPanel>
          }
        />
        <List.Item
          icon={{
            source:
              "https://user-images.githubusercontent.com/14149230/223854538-71327569-76b5-4f77-903c-edf205569927.png",
          }}
          title="Explore Models"
          actions={
            <ActionPanel>
              <Action.Push title="Explore" target={<ListModels token={token} />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={{
            source:
              "https://user-images.githubusercontent.com/14149230/223854538-71327569-76b5-4f77-903c-edf205569927.png",
          }}
          title="Dashboard"
          actions={
            <ActionPanel>
              <Action.OpenInBrowser url="https://replicate.com" />
            </ActionPanel>
          }
        />
      </List>
    </>
  );
}

function RenderForm(props: { token: string; modelName: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [enumMap, setEnumMap] = useState({});

  async function handler(prompt: string) {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${props.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // stable diffusion 2.1
        version: "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",

        // This is the text prompt that will be submitted by a form on the frontend
        input: { prompt: prompt },
      }),
    });

    const prediction = await response.json();
    return JSON.stringify(prediction);
  }

  async function getModelByName(name: string) {
    const model = models.filter((model) => model.name === name);
    return getModel(model[0].modelOwner, model[0].name);
  }

  async function getModel(owner: string, name: string) {
    const response = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
      method: "GET",
      headers: {
        Authorization: `Token ${props.token}`,
        "Content-Type": "application/json",
      },
    });

    console.log(owner, name);

    const result = await response.json();
    const options = result.latest_version.openapi_schema.components.schemas.Input.properties;

    // convert options to array
    const optionsArray = Object.keys(options).map((key) => {
      if ("allOf" in options[key]) {
        setEnumMap((enumMap) => ({
          ...enumMap,
          [key]: result.latest_version.openapi_schema.components.schemas[key].enum,
        }));
      }
      return { name: key, values: options[key] };
    });

    // console.log(optionsArray);

    return optionsArray;
  }

  const handleSubmit = async (values: Values) => {
    setIsLoading(true);
    console.log(values);
    let prediction = await handler(values.textarea);
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
      if (response.status !== 200) {
        console.log(response);
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
              console.log(prediction.output[0]);
            },
          },
        });
      }
    }
  };

  function updateForm(modelName: string) {
    getModelByName(modelName).then((options) => {
      setOptions(options.sort((a, b) => (a.values["x-order"] > b.values["x-order"] ? 1 : -1)));
      console.log(options);
    });
  }

  useEffect(() => {
    getModelByName(props.modelName).then((options) => {
      setOptions(options.sort((a, b) => (a.values["x-order"] > b.values["x-order"] ? 1 : -1)));
      console.log(options);
    });
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
        return option.values.type == "string" || "integer" ? (
          RenderFormInput({ option: option, enums: enumMap[option.name] })
        ) : (
          <Form.Description key={option.name} text={option.name} />
        );
      })}
    </Form>
  );
}

function RenderFormInput(props: { option: any; enums: [string] }) {
  console.log(props.option.values.default);

  function toString(value: any) {
    if (value == null) {
      return "";
    } else {
      return value.toString();
    }
  }
  return "allOf" in props.option.values && props.enums ? (
    <>
      <Form.Description key={props.option.name} text={props.option.name} />
      <Form.Dropdown id={props.option.name}>
        {props.enums.map((value) => (
          <Form.Dropdown.Item key={value} value={value} title={value} />
        ))}
      </Form.Dropdown>
    </>
  ) : (
    <>
      <Form.Description key={props.option.name} text={props.option.name} />
      <Form.TextField id={props.option.name} defaultValue={toString(props.option.values.default)} />
    </>
  );
}

function ListModels(props: { token: string; collection: string }) {
  const [models, setModels] = useState([]);

  async function getModels(collection: string) {
    const response = await fetch(`https://api.replicate.com/v1/collections/${collection}`, {
      method: "GET",
      headers: {
        Authorization: `Token ${props.token}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    setModels(result.models);

    return JSON.stringify(result.models);
  }

  //   async function getImage(url: string) {
  //     const options = { url: url };
  //     const { error, result, response } = await ogs(options);
  //     if (result) {
  //       console.log(result.twitterImage.url);
  //       return result.twitterImage.url;
  //     }
  //     return "🥳";
  //   }

  useEffect(() => {
    getModels("text-to-image");
  });

  return (
    <Grid columns={5}>
      <Grid.Section title="Text to Image Models">
        {models.map((model) => (
          <Grid.Item
            key={model.latest_version.id}
            title={model.name}
            content={"🖼️"}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View Details"
                  target={<DetailModel token={props.token} modelOwner={model.owner} modelName={model.name} />}
                />
              </ActionPanel>
            }
          />
        ))}
      </Grid.Section>
    </Grid>
  );
}

function DetailModel(props: { token: string; modelOwner: string; modelName: string }) {
  const [model, setModel] = useState({});
  const [image, setImage] = useState("🖼️");
  const [markdown, setMarkdown] = useState("");

  async function getModel(owner: string, name: string) {
    const response = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
      method: "GET",
      headers: {
        Authorization: `Token ${props.token}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    setModel(result);

    return JSON.stringify(result);
  }

  useEffect(() => {
    getModel(props.modelOwner, props.modelName);

    const markdown = `
# ${model.name}

![](${model.github_user})

### Description
${model.description}
`;

    setMarkdown(markdown);
  });

  return (
    <Detail
      markdown={markdown}
      navigationTitle={model.name}
      actions={
        <ActionPanel>
          <Action.Push title="Run Model" target={<RenderForm token={props.token} modelName={model.name} />} />
        </ActionPanel>
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Owner" text={model.owner} />
          <Detail.Metadata.Label title="Description" text={model.description} />
          <Detail.Metadata.TagList title="Type">
            <Detail.Metadata.TagList.Item text={model.visibility} color={"#eed535"} />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Separator />
          <Detail.Metadata.Link title="Replicate" target={model.url} text="Replicate" />
          <Detail.Metadata.Link title="GitHub" target={model.github_url} text="GitHub" />
          <Detail.Metadata.Link title="Replicate" target={model.url} text="Replicate" />
        </Detail.Metadata>
      }
    />
  );
}
