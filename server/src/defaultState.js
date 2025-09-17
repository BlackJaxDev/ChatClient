const { nanoid } = require('nanoid');

const MAX_MESSAGES_PER_CHANNEL = 200;

function createDefaultState() {
  const now = new Date().toISOString();
  const systemAuthor = {
    id: 'system',
    name: 'System',
    color: '#94a3b8',
  };

  const welcomeMessage = (content, channelId, serverId) => ({
    id: nanoid(),
    serverId,
    channelId,
    author: systemAuthor,
    content,
    timestamp: now,
    transport: 'server',
    system: true,
  });

  const communityId = nanoid();
  const collabId = nanoid();

  return {
    maxMessagesPerChannel: MAX_MESSAGES_PER_CHANNEL,
    servers: [
      {
        id: communityId,
        name: 'Welcome Hub',
        description: 'A friendly place to meet everyone trying the demo.',
        accentColor: '#5865F2',
        icon: 'W',
        channels: [
          {
            id: nanoid(),
            name: 'general',
            topic: 'Chat about anything and meet new friends',
            messages: [
              welcomeMessage(
                'Welcome to the ChatClient demo! This space is powered by the built-in real-time server.',
                'general',
                communityId
              ),
              welcomeMessage(
                'Switch the transport toggle to try pure peer-to-peer messaging with WebRTC data channels.',
                'general',
                communityId
              ),
            ],
          },
          {
            id: nanoid(),
            name: 'help-desk',
            topic: 'Ask questions about the project or share feedback',
            messages: [
              welcomeMessage(
                'Need help getting started? Drop a message in here.',
                'help-desk',
                communityId
              ),
            ],
          },
        ],
      },
      {
        id: collabId,
        name: 'Collaboration Lab',
        description: 'A sandbox server where you can experiment with channels and peer-to-peer rooms.',
        accentColor: '#2F3136',
        icon: 'C',
        channels: [
          {
            id: nanoid(),
            name: 'ideas',
            topic: 'Share ideas and inspiration',
            messages: [
              welcomeMessage(
                'Invite a teammate and brainstorm together in peer-to-peer mode!',
                'ideas',
                collabId
              ),
            ],
          },
          {
            id: nanoid(),
            name: 'voice-text',
            topic: 'Coordinate audio/video sessions (text only in this demo)',
            messages: [],
          },
        ],
      },
    ],
  };
}

module.exports = {
  MAX_MESSAGES_PER_CHANNEL,
  createDefaultState,
};
