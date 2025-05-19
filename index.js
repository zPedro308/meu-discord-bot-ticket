const { Client, GatewayIntentBits, Partials, PermissionsBitField, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const TOKEN = 'SEU_TOKEN_AQUI';
const TICKET_CHANNEL_ID = '1369350790782652416';
const LOG_CHANNEL_ID = '1369350793181925428';
const TICKET_CATEGORY_ID = '1369350390583263464';
const STAFF_ROLE_ID = '1369352153612943502';

client.once('ready', () => {
  console.log(`Bot online: ${client.user.tag}`);
});

// Envia o painel
client.on('ready', async () => {
  const canal = await client.channels.fetch(TICKET_CHANNEL_ID);
  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('📩 Central de Atendimento')
    .setDescription('> Por gentileza, selecione uma das opções abaixo que melhor se adequa às suas necessidades específicas, para que possamos oferecer a assistência adequada e personalizada que você procura. Nosso objetivo é garantir que você receba o suporte necessário para resolver suas dúvidas, solucionar problemas ou receber orientação especializada.\n\nEscolha a opção que corresponda ao seu interesse, e teremos prazer em ajudá-lo da melhor maneira possível.')
    .setImage('https://cdn.discordapp.com/attachments/URL_DA_IMAGEM.png'); // coloque a imagem do seu link aqui

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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const type = interaction.customId.split('_')[1];
  const existingChannel = interaction.guild.channels.cache.find(c => c.topic === interaction.user.id);
  if (existingChannel) return interaction.reply({ content: '❌ Você já possui um ticket aberto.', ephemeral: true });

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
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
      {
        id: STAFF_ROLE_ID,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
    ],
  });

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(`🎫 Ticket criado - ${type.charAt(0).toUpperCase() + type.slice(1)}`)
    .setDescription(`Olá ${interaction.user}, aguarde um atendente para responder seu ticket.`)
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

// Fecha o ticket e gera transcript
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== 'fechar_ticket') return;

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
});

client.login(TOKEN);
