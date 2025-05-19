const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const TICKET_CATEGORY = config.ticketCategoryId;
const LOG_CHANNEL_ID = config.logChannelId;
const STAFF_ROLE_ID = config.staffRoleId;

client.once('ready', () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

// Enviar mensagem inicial com menu
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'setup') {
    const embed = new EmbedBuilder()
      .setTitle("📌 Sistema de Tickets")
      .setDescription("> Por gentileza, selecione uma das opções abaixo que melhor se adequa às suas necessidades específicas, para que possamos oferecer a assistência adequada e personalizada que você procura...")
      .setColor('Blue');

    const menu = new StringSelectMenuBuilder()
      .setCustomId('menu_ticket')
      .setPlaceholder('Clique aqui para selecionar a categoria!')
      .addOptions([
        { label: 'Dúvidas', value: 'duvidas', emoji: '❓', description: 'Um superior responderá suas dúvidas.' },
        { label: 'Denúncia', value: 'denuncia', emoji: '🚫', description: 'Denúncias contra membros.' },
        { label: 'Recrutamento', value: 'recrutamento', emoji: '🔗', description: 'Dúvidas sobre recrutamento.' },
        { label: 'Revisão de advertência', value: 'advertencia', emoji: '🔍', description: 'Um responsável revisará sua advertência.' },
        { label: 'Financeiro', value: 'financeiro', emoji: '💰', description: 'Entre em contato com o financeiro!' },
        { label: 'PAD', value: 'pad', emoji: '🧑‍⚖️', description: 'Solicite sua defesa de processo administrativo.' },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    await interaction.reply({ embeds: [embed], components: [row] });
  }
});

// Abrir ticket
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId === 'menu_ticket') {
    const category = interaction.values[0];
    const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const existing = interaction.guild.channels.cache.find(c => c.name === channelName);
    if (existing) return interaction.reply({ content: '❌ Você já possui um ticket aberto!', ephemeral: true });

    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle('📩 Ticket Aberto')
      .setDescription(`Olá ${interaction.user}, você abriu um ticket para **${category}**.\nPor favor, aguarde um responsável responder.`)
      .setColor('Green');

    const closeBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [closeBtn] });

    const logEmbed = new EmbedBuilder()
      .setTitle('📥 Ticket Aberto')
      .setDescription(`> Usuário: <@${interaction.user.id}>\n> Categoria: **${category}**\n> Canal: ${channel}`)
      .setColor('Blue');

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) logChannel.send({ embeds: [logEmbed] });

    await interaction.reply({ content: `✅ Seu ticket foi criado: ${channel}`, ephemeral: true });
  }
});

// Fechar ticket e gerar transcript
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'close_ticket') {
    const channel = interaction.channel;
    const messages = await channel.messages.fetch({ limit: 100 });
    const transcript = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');

    const fileName = `transcript-${channel.name}.txt`;
    fs.writeFileSync(fileName, transcript);

    const member = channel.members.find(m => !m.user.bot);
    if (member) {
      try {
        await member.send({
          content: '📝 Aqui está o transcript do seu ticket:',
          files: [fileName]
        });
      } catch (err) {
        console.error('Erro ao enviar transcript:', err.message);
      }
    }

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('📤 Ticket Fechado')
        .setDescription(`> Ticket: ${channel.name}\n> Fechado por: <@${interaction.user.id}>`)
        .setColor('Red');
      logChannel.send({ embeds: [logEmbed] });
    }

    await channel.delete().catch(console.error);
    fs.unlinkSync(fileName);
  }
});

client.login(config.token);
