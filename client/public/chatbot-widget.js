/**
 * ProConnect Chatbot Widget
 * Versão 1.0.0
 * 
 * Este widget permite incorporar o chatbot ProConnect em qualquer site.
 */

(function() {
  // Configurações iniciais
  const scriptElement = document.getElementById('proconnect-chatbot');
  const channelId = scriptElement.getAttribute('data-channel-id');
  
  if (!channelId) {
    console.error('ProConnect Chatbot: Atributo data-channel-id é obrigatório');
    return;
  }
  
  // Obter o host do script
  const scriptSrc = scriptElement.src;
  const host = scriptSrc.substring(0, scriptSrc.indexOf('/chatbot-widget.js'));
  
  // Criar estilos
  const styles = document.createElement('style');
  styles.innerHTML = `
    .pc-chatbot-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    .pc-chatbot-button {
      background-color: #4F46E5;
      color: white;
      border: none;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .pc-chatbot-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
    
    .pc-chatbot-button svg {
      width: 30px;
      height: 30px;
    }
    
    .pc-chatbot-window {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 350px;
      height: 500px;
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
    }
    
    .pc-chatbot-window.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }
    
    .pc-chatbot-header {
      background-color: #4F46E5;
      color: white;
      padding: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .pc-chatbot-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }
    
    .pc-chatbot-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 5px;
    }
    
    .pc-chatbot-body {
      flex: 1;
      padding: 15px;
      overflow-y: auto;
    }
    
    .pc-chatbot-message {
      margin-bottom: 15px;
      max-width: 80%;
      padding: 12px;
      border-radius: 18px;
      line-height: 1.4;
      font-size: 14px;
      position: relative;
    }
    
    .pc-chatbot-message.bot {
      background-color: #F3F4F6;
      color: #111827;
      border-bottom-left-radius: 4px;
      align-self: flex-start;
      margin-right: auto;
    }
    
    .pc-chatbot-message.user {
      background-color: #4F46E5;
      color: white;
      border-bottom-right-radius: 4px;
      align-self: flex-end;
      margin-left: auto;
    }
    
    .pc-chatbot-footer {
      padding: 15px;
      border-top: 1px solid #E5E7EB;
      display: flex;
    }
    
    .pc-chatbot-input {
      flex: 1;
      border: 1px solid #D1D5DB;
      border-radius: 24px;
      padding: 10px 15px;
      font-size: 14px;
      outline: none;
    }
    
    .pc-chatbot-input:focus {
      border-color: #4F46E5;
    }
    
    .pc-chatbot-send {
      background-color: #4F46E5;
      color: white;
      border: none;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      margin-left: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    
    .pc-chatbot-typing {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .pc-chatbot-typing span {
      height: 8px;
      width: 8px;
      border-radius: 50%;
      background-color: #D1D5DB;
      margin: 0 2px;
      animation: typing 1s infinite ease-in-out;
    }
    
    .pc-chatbot-typing span:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .pc-chatbot-typing span:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typing {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    
    .pc-chatbot-options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    
    .pc-chatbot-option {
      background-color: #F3F4F6;
      color: #111827;
      border: 1px solid #D1D5DB;
      border-radius: 16px;
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .pc-chatbot-option:hover {
      background-color: #E5E7EB;
    }
    
    .pc-chatbot-media img,
    .pc-chatbot-media video {
      max-width: 100%;
      border-radius: 12px;
      margin-top: 8px;
    }
    
    @media (max-width: 480px) {
      .pc-chatbot-window {
        width: calc(100% - 40px);
        bottom: 80px;
      }
    }
  `;
  document.head.appendChild(styles);
  
  // Criar estrutura do widget
  const widget = document.createElement('div');
  widget.className = 'pc-chatbot-widget';
  
  // Botão do chat
  const chatButton = document.createElement('button');
  chatButton.className = 'pc-chatbot-button';
  chatButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  widget.appendChild(chatButton);
  
  // Janela do chat
  const chatWindow = document.createElement('div');
  chatWindow.className = 'pc-chatbot-window';
  
  // Cabeçalho da janela
  const chatHeader = document.createElement('div');
  chatHeader.className = 'pc-chatbot-header';
  chatHeader.innerHTML = `
    <h3>ProConnect Chat</h3>
    <button class="pc-chatbot-close">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  chatWindow.appendChild(chatHeader);
  
  // Corpo da janela (mensagens)
  const chatBody = document.createElement('div');
  chatBody.className = 'pc-chatbot-body';
  chatWindow.appendChild(chatBody);
  
  // Rodapé da janela (formulário de entrada)
  const chatFooter = document.createElement('div');
  chatFooter.className = 'pc-chatbot-footer';
  chatFooter.innerHTML = `
    <input type="text" class="pc-chatbot-input" placeholder="Digite sua mensagem...">
    <button class="pc-chatbot-send">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  `;
  chatWindow.appendChild(chatFooter);
  
  widget.appendChild(chatWindow);
  document.body.appendChild(widget);
  
  // Variáveis de estado
  let isOpen = false;
  let conversation = {
    id: null,
    messages: []
  };
  let isTyping = false;
  
  // Função para alternar a visibilidade da janela
  function toggleChatWindow() {
    isOpen = !isOpen;
    chatWindow.classList.toggle('open', isOpen);
    
    if (isOpen && !conversation.id) {
      // Iniciar conversa
      startConversation();
    }
  }
  
  // Função para iniciar uma conversa
  function startConversation() {
    addMessage('bot', 'Olá! Como posso ajudar você hoje?');
    showTyping();
    
    // Simular obtenção de opções iniciais da API
    setTimeout(() => {
      hideTyping();
      
      const options = [
        { text: 'Fazer um pedido', value: 'order' },
        { text: 'Dúvidas frequentes', value: 'faq' },
        { text: 'Falar com atendente', value: 'agent' }
      ];
      
      addOptions(options);
    }, 1000);
  }
  
  // Função para adicionar uma mensagem
  function addMessage(sender, text, media = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `pc-chatbot-message ${sender}`;
    messageDiv.textContent = text;
    
    if (media) {
      const mediaDiv = document.createElement('div');
      mediaDiv.className = 'pc-chatbot-media';
      
      if (media.type === 'image') {
        const img = document.createElement('img');
        img.src = media.url;
        img.alt = media.caption || '';
        mediaDiv.appendChild(img);
      } else if (media.type === 'video') {
        const video = document.createElement('video');
        video.src = media.url;
        video.controls = true;
        mediaDiv.appendChild(video);
      }
      
      messageDiv.appendChild(mediaDiv);
    }
    
    chatBody.appendChild(messageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
    
    // Adicionar a mensagem ao histórico
    conversation.messages.push({
      sender,
      text,
      media,
      timestamp: new Date().toISOString()
    });
  }
  
  // Função para adicionar opções de resposta
  function addOptions(options) {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'pc-chatbot-options';
    
    options.forEach(option => {
      const optionButton = document.createElement('button');
      optionButton.className = 'pc-chatbot-option';
      optionButton.textContent = option.text;
      optionButton.dataset.value = option.value;
      
      optionButton.addEventListener('click', () => {
        selectOption(option);
      });
      
      optionsDiv.appendChild(optionButton);
    });
    
    chatBody.appendChild(optionsDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  
  // Função para selecionar uma opção
  function selectOption(option) {
    // Remover todas as opções existentes
    const optionDivs = chatBody.querySelectorAll('.pc-chatbot-options');
    optionDivs.forEach(div => div.remove());
    
    // Adicionar a resposta do usuário
    addMessage('user', option.text);
    
    // Simular a resposta do bot
    showTyping();
    
    // Chamaria uma API real neste ponto para obter a próxima resposta
    setTimeout(() => {
      hideTyping();
      
      switch (option.value) {
        case 'order':
          addMessage('bot', 'Ótimo! Você gostaria de fazer um novo pedido ou consultar um pedido existente?');
          addOptions([
            { text: 'Novo pedido', value: 'new_order' },
            { text: 'Consultar pedido', value: 'check_order' }
          ]);
          break;
          
        case 'faq':
          addMessage('bot', 'Aqui estão algumas perguntas frequentes:');
          addOptions([
            { text: 'Como cancelar um pedido?', value: 'cancel_order_faq' },
            { text: 'Formas de pagamento', value: 'payment_methods_faq' },
            { text: 'Prazos de entrega', value: 'delivery_time_faq' }
          ]);
          break;
          
        case 'agent':
          addMessage('bot', 'Estou te direcionando para um atendente humano. Por favor, aguarde um momento.');
          setTimeout(() => {
            addMessage('bot', 'Olá, meu nome é Carlos e estou assumindo seu atendimento. Em que posso ajudar?');
          }, 2000);
          break;
          
        default:
          addMessage('bot', 'Desculpe, não entendi sua escolha. Pode tentar novamente?');
          break;
      }
    }, 1000);
  }
  
  // Função para mostrar indicador de digitação
  function showTyping() {
    if (isTyping) return;
    
    isTyping = true;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'pc-chatbot-typing';
    typingDiv.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;
    
    chatBody.appendChild(typingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  
  // Função para esconder indicador de digitação
  function hideTyping() {
    isTyping = false;
    const typingDiv = chatBody.querySelector('.pc-chatbot-typing');
    if (typingDiv) {
      typingDiv.remove();
    }
  }
  
  // Função para enviar mensagem
  function sendMessage() {
    const input = chatWindow.querySelector('.pc-chatbot-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Adicionar mensagem do usuário
    addMessage('user', message);
    
    // Limpar o campo de entrada
    input.value = '';
    
    // Simular resposta do bot
    showTyping();
    
    // Em uma implementação real, aqui chamaria a API do chatbot
    setTimeout(() => {
      hideTyping();
      
      // Resposta simulada
      addMessage('bot', 'Obrigado por sua mensagem. Como posso ajudar mais?');
    }, 1000);
  }
  
  // Event listeners
  chatButton.addEventListener('click', toggleChatWindow);
  chatWindow.querySelector('.pc-chatbot-close').addEventListener('click', toggleChatWindow);
  
  const sendButton = chatWindow.querySelector('.pc-chatbot-send');
  sendButton.addEventListener('click', sendMessage);
  
  const input = chatWindow.querySelector('.pc-chatbot-input');
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // Carregar configurações do canal
  function loadChannelSettings() {
    fetch(`${host}/api/channels/${channelId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Erro ao carregar configurações do canal');
        }
        return response.json();
      })
      .then(data => {
        const credentials = data.credentials || {};
        
        // Atualizar aparência do widget com as configurações do canal
        if (credentials.primaryColor) {
          // Atualizar cor primária
          document.documentElement.style.setProperty('--pc-primary-color', credentials.primaryColor);
          
          chatButton.style.backgroundColor = credentials.primaryColor;
          chatHeader.style.backgroundColor = credentials.primaryColor;
          chatWindow.querySelector('.pc-chatbot-send').style.backgroundColor = credentials.primaryColor;
        }
        
        if (credentials.widgetName) {
          // Atualizar nome do widget
          chatHeader.querySelector('h3').textContent = credentials.widgetName;
        }
      })
      .catch(error => {
        console.error('ProConnect Chatbot:', error);
      });
  }
  
  // Tentar carregar configurações do canal
  try {
    loadChannelSettings();
  } catch (error) {
    console.error('ProConnect Chatbot:', error);
  }
})();