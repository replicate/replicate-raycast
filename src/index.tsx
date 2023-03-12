import { ActionPanel, Action, getPreferenceValues, List, Icon } from "@raycast/api";
import { models } from "./models";
import RenderForm from "./components/Form";

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
          accessories={[{ icon: Icon.ArrowNe }]}
          actions={
            <Action.OpenInBrowser title="Show Details" url={"https://replicate.com/collections/diffusion-models"} />
          }
        />
        <List.Item
          icon={{
            source:
              "https://user-images.githubusercontent.com/14149230/223854538-71327569-76b5-4f77-903c-edf205569927.png",
          }}
          title="Dashboard"
          accessories={[{ icon: Icon.ArrowNe }]}
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
