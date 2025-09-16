import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Button,
  Divider,
  Grid,
  Header,
  Icon,
  Label,
  List,
  Menu,
  Segment,
} from "semantic-ui-react";
import "./Home.css";

const serverSeeds = [
  {
    id: "product-labs",
    name: "Product Labs",
    description:
      "Company-wide hub for product planning and sprint coordination.",
    memberCount: 28,
    onlineCount: 17,
    channels: [
      {
        id: "announcements",
        name: "#announcements",
        topic: "Roadmap updates from leadership.",
        unread: 2,
        activityWindow: "Most active in the mornings",
        lastMessage: {
          author: "Evelyn Walker",
          preview:
            "🚀 Feature freeze ends Friday – check the release checklist.",
          timestamp: "Today • 9:41 AM",
        },
      },
      {
        id: "daily-standups",
        name: "#daily-standups",
        topic: "Async updates across all squads.",
        unread: 6,
        activityWindow: "Most active at 9:00 AM",
        lastMessage: {
          author: "Santiago Vega",
          preview: "Infrastructure squad is rolling a hotfix to staging.",
          timestamp: "Today • 9:15 AM",
        },
      },
      {
        id: "watercooler",
        name: "#watercooler",
        topic: "Drop casual chatter, wins, and memes.",
        unread: 0,
        activityWindow: "Most active after lunch",
        lastMessage: {
          author: "Mia Chen",
          preview: "Uploaded photos from the offsite scavenger hunt.",
          timestamp: "Yesterday • 5:22 PM",
        },
      },
    ],
  },
  {
    id: "design-guild",
    name: "Design Guild",
    description:
      "Feedback loops for product designers and UX researchers.",
    memberCount: 19,
    onlineCount: 11,
    channels: [
      {
        id: "critique",
        name: "#critique",
        topic: "Post screens for the Thursday design review.",
        unread: 4,
        activityWindow: "Most active on Thursdays",
        lastMessage: {
          author: "Avery Lin",
          preview:
            "Drafted the accessibility checklist for the new nav.",
          timestamp: "Today • 10:32 AM",
        },
      },
      {
        id: "figma-lounge",
        name: "#figma-lounge",
        topic: "Share work-in-progress files and component updates.",
        unread: 1,
        activityWindow: "Most active in the afternoons",
        lastMessage: {
          author: "Noah Delgado",
          preview: "Pushed a new variant to the button kit.",
          timestamp: "Today • 8:05 AM",
        },
      },
      {
        id: "research",
        name: "#research",
        topic: "Discuss findings from ongoing user studies.",
        unread: 0,
        activityWindow: "Most active on Mondays",
        lastMessage: {
          author: "Priya Raman",
          preview:
            "Synthesis doc for the onboarding interviews is ready.",
          timestamp: "Yesterday • 4:18 PM",
        },
      },
    ],
  },
  {
    id: "community-success",
    name: "Community Success",
    description:
      "Keep a pulse on customer feedback and advocacy programs.",
    memberCount: 23,
    onlineCount: 9,
    channels: [
      {
        id: "customer-highlights",
        name: "#customer-highlights",
        topic: "Share notable wins and testimonials.",
        unread: 3,
        activityWindow: "Most active at 3:00 PM",
        lastMessage: {
          author: "Lena Ortiz",
          preview: "Acme Co. rolled out the beta to 250 new users.",
          timestamp: "Today • 2:48 PM",
        },
      },
      {
        id: "support-sync",
        name: "#support-sync",
        topic: "Escalations and insights from the support desk.",
        unread: 5,
        activityWindow: "Most active before handoff",
        lastMessage: {
          author: "Mateo Jensen",
          preview:
            "Ticket 4821 is ready for a knowledge-base article draft.",
          timestamp: "Today • 1:27 PM",
        },
      },
      {
        id: "events",
        name: "#events",
        topic: "Coordinate livestreams and community programming.",
        unread: 0,
        activityWindow: "Most active mid-week",
        lastMessage: {
          author: "Harper West",
          preview: "Shared the final run-of-show for next week's AMA.",
          timestamp: "Yesterday • 6:03 PM",
        },
      },
    ],
  },
];

function Home()
{
  const history = useHistory();
  const [servers, setServers] = useState(serverSeeds);
  const [selectedServerId, setSelectedServerId] = useState(
    serverSeeds[0]?.id ?? null
  );
  const [selectedChannelId, setSelectedChannelId] = useState(
    serverSeeds[0]?.channels[0]?.id ?? null
  );

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId) ?? null,
    [servers, selectedServerId]
  );

  const selectedChannel = useMemo(
    () =>
      selectedServer?.channels.find((channel) => channel.id === selectedChannelId) ??
      null,
    [selectedServer, selectedChannelId]
  );

  useEffect(() =>
  {
    if (!selectedServer)
    {
      if (selectedChannelId !== null)
      {
        setSelectedChannelId(null);
      }
      return;
    }

    const channelExists = selectedServer.channels.some(
      (channel) => channel.id === selectedChannelId
    );

    if (channelExists)
    {
      return;
    }

    const fallbackChannel =
      selectedServer.channels.find((channel) => channel.unread > 0) ??
      selectedServer.channels[0] ??
      null;

    setSelectedChannelId(fallbackChannel ? fallbackChannel.id : null);
  }, [selectedServer, selectedChannelId]);

  const totalUnreadForSelectedServer = useMemo(() =>
  {
    if (!selectedServer)
    {
      return 0;
    }

    return selectedServer.channels.reduce(
      (total, channel) => total + channel.unread,
      0
    );
  }, [selectedServer]);

  const handleSelectServer = (serverId) =>
  {
    setSelectedServerId(serverId);
  };

  const handleSelectChannel = (channelId) =>
  {
    setSelectedChannelId(channelId);
  };

  const openChannel = (serverId, channelId) =>
  {
    history.push({
      pathname: `/server/${serverId}`,
      state: { channelId },
    });
  };

  const markChannelAsRead = () =>
  {
    if (!selectedServer || !selectedChannel)
    {
      return;
    }

    setServers((currentServers) =>
      currentServers.map((server) =>
      {
        if (server.id !== selectedServer.id)
        {
          return server;
        }

        return {
          ...server,
          channels: server.channels.map((channel) =>
            channel.id === selectedChannel.id
              ? { ...channel, unread: 0 }
              : channel
          ),
        };
      })
    );
  };

  return (
    <div className="component-home">
      <Header
        as="h1"
        className="home-title"
        content="Choose where to jump in"
        subheader="Browse your servers, switch channels, and catch up on unread conversations."
      />

      <Grid stackable columns={3} className="home-layout-grid">
        <Grid.Column width={5}>
          <Header
            as="h3"
            content="Your servers"
            subheader="Stay connected with the teams you collaborate with daily."
          />
          <Menu fluid vertical pointing secondary className="home-server-menu">
            {servers.map((server) =>
            {
              const serverUnread = server.channels.reduce(
                (total, channel) => total + channel.unread,
                0
              );

              return (
                <Menu.Item
                  key={server.id}
                  active={server.id === selectedServerId}
                  onClick={() => handleSelectServer(server.id)}
                  onKeyDown={(event) =>
                  {
                    if (event.key === "Enter" || event.key === " ")
                    {
                      event.preventDefault();
                      handleSelectServer(server.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <div className="server-name-row">
                    <span>{server.name}</span>
                    {serverUnread > 0 && (
                      <Label circular color="teal" size="mini">
                        {serverUnread}
                      </Label>
                    )}
                  </div>
                  <div className="server-meta">
                    <span>
                      <Icon name="users" />
                      {server.memberCount} members
                    </span>
                    <span>
                      <Icon name="circle" color="green" />
                      {server.onlineCount} online
                    </span>
                  </div>
                </Menu.Item>
              );
            })}
          </Menu>

          <Segment secondary className="home-explore">
            <Header as="h4">
              <Icon name="compass" />
              <Header.Content>
                Discover more servers
                <Header.Subheader>
                  Browse the public directory to expand your network when you're ready.
                </Header.Subheader>
              </Header.Content>
            </Header>
          </Segment>
        </Grid.Column>

        <Grid.Column width={5}>
          <Segment raised className="home-channel-panel">
            {selectedServer ? (
              <>
                <div className="channel-panel-header">
                  <Header as="h3">{selectedServer.name}</Header>
                  <p>{selectedServer.description}</p>
                  <div className="channel-panel-meta">
                    <span>
                      <Icon name="users" />
                      {selectedServer.memberCount} members
                    </span>
                    <span>
                      <Icon name="circle" color="green" />
                      {selectedServer.onlineCount} online
                    </span>
                    {totalUnreadForSelectedServer > 0 && (
                      <span className="channel-panel-unread">
                        <Icon name="mail" />
                        {totalUnreadForSelectedServer} unread messages
                      </span>
                    )}
                  </div>
                </div>
                <Divider />
                <List selection relaxed className="home-channel-list">
                  {selectedServer.channels.map((channel) =>
                  {
                    const isActive = channel.id === selectedChannelId;
                    return (
                      <List.Item
                        key={channel.id}
                        className={`home-channel-item${isActive ? " active" : ""}`}
                        onClick={() => handleSelectChannel(channel.id)}
                        onKeyDown={(event) =>
                        {
                          if (event.key === "Enter" || event.key === " ")
                          {
                            event.preventDefault();
                            handleSelectChannel(channel.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isActive}
                      >
                        <List.Content floated="right">
                          {channel.unread > 0 && (
                            <Label circular color="red" size="mini">
                              {channel.unread}
                            </Label>
                          )}
                        </List.Content>
                        <List.Icon name="hashtag" size="large" verticalAlign="middle" />
                        <List.Content>
                          <List.Header>{channel.name}</List.Header>
                          <List.Description>{channel.topic}</List.Description>
                        </List.Content>
                      </List.Item>
                    );
                  })}
                </List>
              </>
            ) : (
              <div className="home-empty-state">
                Join a server to see its channels here.
              </div>
            )}
          </Segment>
        </Grid.Column>

        <Grid.Column width={6}>
          {selectedServer && selectedChannel ? (
            <div className="home-channel-details">
              <Segment raised className="home-channel-detail-card">
                <div className="channel-header">
                  <Header as="h2">{selectedChannel.name}</Header>
                  {selectedChannel.unread > 0 && (
                    <Label color="red">{selectedChannel.unread} new</Label>
                  )}
                </div>
                <p className="channel-topic">{selectedChannel.topic}</p>
                <div className="channel-stats">
                  <span>
                    <Icon name="users" />
                    {selectedServer.memberCount} members
                  </span>
                  <span>
                    <Icon name="clock outline" />
                    {selectedChannel.activityWindow}
                  </span>
                </div>
                <Divider />
                <div className="channel-activity">
                  <Header as="h4">Latest update</Header>
                  <div className="channel-activity-entry">
                    <Icon name="comment alternate outline" size="large" />
                    <div>
                      <div className="activity-author">
                        {selectedChannel.lastMessage.author}
                      </div>
                      <div className="activity-preview">
                        {selectedChannel.lastMessage.preview}
                      </div>
                      <div className="activity-meta">
                        {selectedChannel.lastMessage.timestamp}
                      </div>
                    </div>
                  </div>
                </div>
              </Segment>
              <div className="channel-actions">
                <Button
                  primary
                  icon
                  labelPosition="right"
                  onClick={() => openChannel(selectedServer.id, selectedChannel.id)}
                >
                  Jump into channel
                  <Icon name="arrow right" />
                </Button>
                <Button
                  basic
                  icon
                  onClick={markChannelAsRead}
                  disabled={selectedChannel.unread === 0}
                >
                  <Icon name="check" />
                  Mark as read
                </Button>
              </div>
            </div>
          ) : (
            <Segment className="home-empty-state" placeholder>
              <Header icon>
                <Icon name="hashtag" />
                Select a channel to preview its details.
              </Header>
            </Segment>
          )}
        </Grid.Column>
      </Grid>
    </div>
  );
}

export default Home;
