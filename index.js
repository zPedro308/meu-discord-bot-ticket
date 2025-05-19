// index.js
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  StringSelectMenuBuilder
} = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Configurações fixas
const STAFF_ROLE_ID = '1369352153612943502';
const LOG_CHANNEL_ID = '1369350793181925428';
const TICKET_CATEGORY_ID = '1369350390583263464'; // Coloque a ID da categoria de tickets

// Dados do select menu, emojis e labels conforme as imagens
const ticketOptions = [
  {
    label: 'Dúvidas',
    description: 'Tire suas dúvidas gerais',
    emoji: '❓',
    value: 'duvidas',
  },
  {
    label: 'Suporte Técnico',
    description: 'Problemas técnicos e suporte',
    emoji: '🛠️',
    value: 'suporte_tecnico',
  },
  {
    label: 'Financeiro',
    description: 'Assuntos financeiros e pagamentos',
    emoji: '💰',
    value: 'financeiro',
  },
  {
    label: 'Denúncias',
    description: 'Faça denúncias anonimamente',
    emoji: '🚨',
    value: 'denuncias',
  },
  {
    label: 'Reclamações',
    description: 'Registrar reclamações sobre serviços',
    emoji: '⚠️',
    value: 'reclamacoes',
  },
  {
    label: 'Sugestões',
    description: 'Envie suas sugestões para melhoria',
    emoji: '💡',
    value: 'sugestoes',
  },
  {
    label: 'Outros',
    description: 'Assuntos diversos e outros tickets',
    emoji: '📋',
    value: 'outros',
  },
];

// Comando /painelticket
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'painelticket') {
    // Embed do painel
    const embed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle('📩 Central de Atendimento')
      .setDescription(
        'Por gentileza, selecione uma das opções abaixo que melhor se adequa às suas necessidades específicas, para que possamos oferecer a assistência adequada e personalizada que você procura.\n\n' +
        'Nosso objetivo é garantir que você receba o suporte necessário para resolver suas dúvidas, solucionar problemas ou receber orientação especializada.\n\n' +
        'Escolha a opção que corresponda ao seu interesse, e teremos prazer em ajudá-lo da melhor maneira possível.'
      )
      .setImage('https://i.imgur.com/7mURWzG.png') // Banner igual da imagem (coloque o link da sua imagem de banner aqui)
      .setFooter({ text: 'Painel de tickets - Seleciona uma categoria para abrir um ticket' });

    // Select menu com todas as opções
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_ticket_category')
      .setPlaceholder('Selecione a categoria do seu ticket')
      .addOptions(ticketOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
  }
});

// Criação do ticket após seleção da categoria
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'select_ticket_category') {
    const selected = interaction.values[0];
    const user = interaction.user;

    // Checar se já tem ticket aberto
    const existingChannel = interaction.guild.channels.cache.find(
      c => c.topic === user.id && c.parentId === TICKET_CATEGORY_ID
    );
    if (existingChannel) {
      return interaction.reply({ content: `❌ Você já possui um ticket aberto: ${existingChannel}`, ephemeral: true });
    }

    // Criar canal de ticket
    const channel = await interaction.guild.channels.create({
      name: `ticket-${user.username.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      topic: user.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: user.id,
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

    // Embed inicial do ticket
    const ticketEmbed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle(`🎫 Ticket aberto - ${selected.charAt(0).toUpperCase() + selected.slice(1).replace('_', ' ')}`)
      .setDescription(`Olá ${user}, aguarde enquanto um membro da equipe irá atendê-lo.`)
      .setFooter({ text: 'Use o botão abaixo para fechar o ticket' });

    // Botão de fechar
    const closeButton = new ButtonBuilder()
      .setCustomId('fechar_ticket')
      .setLabel('Fechar Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

    await channel.send({ content: `<@&${STAFF_ROLE_ID}> | ${user}`, embeds: [ticketEmbed], components: [row] });
    await interaction.reply({ content: `✅ Ticket criado: ${channel}`, ephemeral: true });

    // Log no canal de logs
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
    logChannel.send(`📥 ${user.tag} abriu um ticket: ${channel}`);
  }
});

// Fechar ticket
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'fechar_ticket') {
    const channel = interaction.channel;

    // Verifica se quem clicou é o dono do ticket ou staff
    if (channel.topic !== interaction.user.id && !interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Apenas o autor do ticket ou um membro da equipe pode fechar o ticket.', ephemeral: true });
    }

    await interaction.reply({ content: '🔒 Fechando o ticket...', ephemeral: true });

    // Enviar log
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
    logChannel.send(`📤 Ticket fechado: ${channel.name} por ${interaction.user.tag}`);

    // Deleta o canal depois de 5 segundos
    setTimeout(() => channel.delete().catch(() => null), 5000);
  }
});

// Registro do comando /painelticket
client.once('ready', async () => {
  console.log(`Bot online: ${client.user.tag}`);

  const data = [
    {
      name: 'painelticket',
      description: 'Enviar painel para abertura de tickets',
    },
  ];

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (guild) {
    await guild.commands.set(data);
    console.log('Comandos registrados no servidor.');
  } else {
    console.log('Guild não encontrada para registrar comandos.');
  }
});

client.login(process.env.TOKEN);
