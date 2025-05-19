const { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const { token } = require('./config.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const LOG_CHANNEL_ID = '1369350793181925428';
const CATEGORY_ID = '1369350390583263464';
const STAFF_ROLE_ID = '1369352153612943502';

client.once('ready', () => {
  console.log(`✅ Bot logado como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'ticket') {
    const embed = new EmbedBuilder()
      .setTitle('Clique aqui para selecionar a categoria!')
      .setDescription('> Por gentileza, selecione uma das opções abaixo que melhor se adequa às suas necessidades específicas...')
      .setColor('Blurple');

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Selecione uma categoria')
      .addOptions([
        { label: 'Dúvidas', description: 'Um superior responderá suas dúvidas.', value: 'duvidas', emoji: '❓' },
        { label: 'Denúncia', description: 'Denúncias contra membros.', value: 'denuncia', emoji: '🚫' },
        { label: 'Recrutamento', description: 'Dúvida sobre recrutamento.', value: 'recrutamento', emoji: '🔗' },
        { label: 'Revisão de advertência', description: 'Um responsável revisará sua advertência.', value: 'advertencia', emoji: '🔍' },
        { label: 'Financeiro', description: 'Entre em contato com o financeiro!', value: 'financeiro', emoji: '💰' },
        { label: 'PAD', description: 'Solicite sua defesa.', value: 'pad', emoji: '🧑‍⚖️' }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const category = interaction.values[0];
    const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '');

    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle(`Atendimento: ${category}`)
      .setDescription(`Olá ${interaction.user}, aguarde o atendimento de um responsável.`)
      .setColor('Green')
      .setFooter({ text: 'Use o botão abaixo para fechar o ticket.' });

    const closeBtn = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Fechar Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeBtn);

    await channel.send({ content: `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [row] });

    await interaction.reply({ content: `✅ Ticket criado em ${channel}`, ephemeral: true });

    const log = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (log) log.send(`📩 Ticket criado por ${interaction.user} em ${channel}`);
  }

  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Você não tem permissão para fechar tickets.', ephemeral: true });
    }

    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const transcript = messages
      .reverse()
      .map(m => `${m.author.tag}: ${m.content}`)
      .join('
');

    const filePath = `./transcripts/${interaction.channel.id}.txt`;
    fs.writeFileSync(filePath, transcript);

    const user = interaction.channel.members.find(m => !m.user.bot && !m.roles.cache.has(STAFF_ROLE_ID));
    if (user) {
      await user.send({
        content: '📝 Aqui está o transcript do seu ticket:',
        files: [filePath]
      }).catch(() => {});
    }

    const log = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (log) log.send(`📁 Ticket fechado e transcript enviado para ${user?.user.tag || 'desconhecido'}`);

    await interaction.channel.delete();
    fs.unlinkSync(filePath);
  }
});

client.login(token);