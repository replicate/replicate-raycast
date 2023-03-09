import { useEffect, useState } from "react";
import { ActionPanel, Action, Grid } from "@raycast/api";
import DetailModel from "./DetailModel";
import fetch from "node-fetch";

export default function ListModels(props: { token: string; collection: string }) {
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
