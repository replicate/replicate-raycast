import { ActionPanel, Action, Detail, getPreferenceValues, List, Grid } from "@raycast/api";
import fetch from "node-fetch";
import { useEffect, useState } from "react";
import { models, Model } from "./models";
import RenderForm from "./Form";

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
