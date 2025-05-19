// index.js
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  Events
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Para usar variáveis do .env

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// IDs configuráveis por variáveis de ambiente
const TICKET_CHANNEL_ID = process.env.TICKET_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

client.once('ready', async () => {
  console.log(`Bot online: ${client.user.tag}`);

  const canal = await client.channels.fetch(TICKET_CHANNEL_ID);
  if (!canal) return console.log('Canal de ticket não encontrado.');

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('📩 Central de Atendimento')
    .setDescription('> Selecione uma das opções abaixo para abrir um ticket personalizado.')
    .setImage('https://pmespconcurso.com.br/wp-content/uploads/2022/06/identidade-1024x369.png'); // troque esse link

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_duvida')
      .setLabel('Dúvidas')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_suporte')
      .setLabel('Suporte')
      .setStyle(ButtonStyle.Secondary)
  );

  canal.send({ embeds: [embed], components: [row] });
});

// Criação de ticket
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'fechar_ticket') {
    const channel = interaction.channel;
    if (channel.topic !== interaction.user.id && !interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Apenas o autor do ticket ou um staff pode fechá-lo.', ephemeral: true });
    }

    const messages = await channel.messages.fetch({ limit: 100 });
    const transcript = messages
      .filter(m => !m.author.bot)
      .map(m => `${m.author.tag}: ${m.content}`)
      .reverse()
      .join('\n');

    const filePath = path.join(__dirname, `transcript-${channel.id}.txt`);
    fs.writeFileSync(filePath, transcript);

    const user = await interaction.guild.members.fetch(channel.topic);
    if (user) {
      await user.send({
        content: '📄 Aqui está a transcrição do seu ticket:',
        files: [filePath]
      }).catch(() => null);
    }

    const log = await client.channels.fetch(LOG_CHANNEL_ID);
    log.send(`📤 Ticket fechado: ${channel.name} por ${interaction.user}`);

    await channel.delete();
    fs.unlinkSync(filePath);
    return;
  }

  // Criação do ticket
  const type = interaction.customId.split('_')[1];
  const existingChannel = interaction.guild.channels.cache.find(c => c.topic === interaction.user.id);
  if (existingChannel) {
    return interaction.reply({ content: '❌ Você já possui um ticket aberto.', ephemeral: true });
  }

  const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    topic: interaction.user.id,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
    ],
  });

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(`🎫 Ticket criado - ${type.charAt(0).toUpperCase() + type.slice(1)}`)
    .setDescription(`Olá ${interaction.user}, aguarde um atendente.`)
    .setFooter({ text: 'Use o botão abaixo para fechar o ticket.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('fechar_ticket')
      .setLabel('Fechar Ticket')
      .setStyle(ButtonStyle.Danger)
  );

  channel.send({ content: `<@&${STAFF_ROLE_ID}> | ${interaction.user}`, embeds: [embed], components: [row] });

  interaction.reply({ content: `✅ Ticket criado: ${channel}`, ephemeral: true });

  const log = await client.channels.fetch(LOG_CHANNEL_ID);
  log.send(`📥 ${interaction.user} abriu um ticket: ${channel}`);
});

client.login(process.env.TOKEN);
