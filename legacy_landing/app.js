// NovaFlow Interactive Application Logic

document.addEventListener('DOMContentLoaded', () => {
  initIntegrations();
  initSimulator();
  initDockerCopy();
  initPricingToggle();
  initFAQ();
  initMobileMenu();
  
  // Dynamic Bezier curves alignment
  updateWireCoordinates();
  setTimeout(updateWireCoordinates, 150);
  window.addEventListener('resize', updateWireCoordinates);
});

function updateWireCoordinates() {
  const canvas = document.getElementById('canvas-area');
  const p1Out = document.getElementById('pin-1-out');
  const p2In = document.getElementById('pin-2-in');
  const p2Out = document.getElementById('pin-2-out');
  const p3In = document.getElementById('pin-3-in');
  const p3OutA = document.getElementById('pin-3-out-a');
  const p3OutB = document.getElementById('pin-3-out-b');
  const p4aIn = document.getElementById('pin-4a-in');
  const p4bIn = document.getElementById('pin-4b-in');

  if (!canvas || !p1Out || !p2In || !p2Out || !p3In || !p3OutA || !p3OutB || !p4aIn || !p4bIn) return;

  const canvasRect = canvas.getBoundingClientRect();

  function getPinPos(el) {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left + r.width / 2 - canvasRect.left + canvas.scrollLeft),
      y: Math.round(r.top + r.height / 2 - canvasRect.top + canvas.scrollTop)
    };
  }

  function setWirePath(wireBaseId, wirePulseId, pt1, pt2) {
    const dx = Math.max(45, (pt2.x - pt1.x) * 0.5);
    const d = `M ${pt1.x} ${pt1.y} C ${pt1.x + dx} ${pt1.y}, ${pt2.x - dx} ${pt2.y}, ${pt2.x} ${pt2.y}`;
    const base = document.getElementById(wireBaseId);
    const pulse = document.getElementById(wirePulseId);
    if (base) base.setAttribute('d', d);
    if (pulse) pulse.setAttribute('d', d);
  }

  const pos1Out = getPinPos(p1Out);
  const pos2In = getPinPos(p2In);
  const pos2Out = getPinPos(p2Out);
  const pos3In = getPinPos(p3In);
  const pos3OutA = getPinPos(p3OutA);
  const pos3OutB = getPinPos(p3OutB);
  const pos4aIn = getPinPos(p4aIn);
  const pos4bIn = getPinPos(p4bIn);

  setWirePath('wire-1', 'wire-pulse-1', pos1Out, pos2In);
  setWirePath('wire-2', 'wire-pulse-2', pos2Out, pos3In);
  setWirePath('wire-3a', 'wire-pulse-3a', pos3OutA, pos4aIn);
  setWirePath('wire-3b', 'wire-pulse-3b', pos3OutB, pos4bIn);
}

// ==========================================
// 1. INTEGRATIONS CATALOG & FILTERING
// ==========================================
const integrationsData = [
  { name: 'OpenAI (GPT-4o)', cat: 'ai', icon: '🤖', desc: 'Completions, Embeddings & DALL-E' },
  { name: 'Anthropic Claude', cat: 'ai', icon: '🧠', desc: 'Claude 3.5 Sonnet & Haiku' },
  { name: 'Ollama Local', cat: 'ai', icon: '🦙', desc: 'LLMs locales sin costo en tu servidor' },
  { name: 'Pinecone / Qdrant', cat: 'ai', icon: '🌲', desc: 'Bases de datos vectoriales y RAG' },
  { name: 'PostgreSQL & pgvector', cat: 'db', icon: '🐘', desc: 'Consultas SQL, triggers y vectores' },
  { name: 'MongoDB', cat: 'db', icon: '🍃', desc: 'Agregaciones y pipelines de documentos' },
  { name: 'Supabase', cat: 'db', icon: '⚡', desc: 'Base de datos en tiempo real y Auth' },
  { name: 'Redis', cat: 'db', icon: '🔴', desc: 'Caché, pub/sub y colas de mensajes' },
  { name: 'Slack', cat: 'comms', icon: '💬', desc: 'Mensajes, interactividad y bots' },
  { name: 'Discord', cat: 'comms', icon: '🎮', desc: 'Webhooks y comandos de servidor' },
  { name: 'Gmail / Google Workspace', cat: 'comms', icon: '✉️', desc: 'Lectura, envío y etiquetas' },
  { name: 'Telegram Bot', cat: 'comms', icon: '✈️', desc: 'Bots automáticos y canales' },
  { name: 'HubSpot', cat: 'crm', icon: '🟠', desc: 'Sincronización de leads y deals' },
  { name: 'Stripe', cat: 'crm', icon: '💳', desc: 'Eventos de pago, suscripciones e invoices' },
  { name: 'Notion', cat: 'crm', icon: '📑', desc: 'Bases de datos, páginas y bloques' },
  { name: 'Airtable', cat: 'crm', icon: '📊', desc: 'Tablas relacionales y automatizaciones' },
  { name: 'GitHub', cat: 'dev', icon: '🐙', desc: 'Issues, pull requests y actions' },
  { name: 'AWS S3 & Lambda', cat: 'dev', icon: '☁️', desc: 'Almacenamiento de archivos y funciones' },
  { name: 'Docker / Portainer', cat: 'dev', icon: '🐳', desc: 'Gestión de contenedores remotos' },
  { name: 'Jira Software', cat: 'dev', icon: '📋', desc: 'Tickets ágiles y seguimiento de bugs' },
  { name: 'Shopify', cat: 'crm', icon: '🛍️', desc: 'Pedidos de e-commerce y stock' },
  { name: 'Webhook Genérico HTTP', cat: 'dev', icon: '🌐', desc: 'Cualquier API REST o GraphQL' },
  { name: 'Google Sheets', cat: 'comms', icon: '📈', desc: 'Lectura y escritura en hojas de cálculo' },
  { name: 'Twilio / WhatsApp', cat: 'comms', icon: '📱', desc: 'Envío de SMS y mensajes de WhatsApp' }
];

function initIntegrations() {
  const grid = document.getElementById('integrations-grid');
  const searchInput = document.getElementById('integration-search');
  const categoryPills = document.querySelectorAll('.cat-pill');

  let currentCategory = 'all';
  let searchQuery = '';

  function render() {
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = integrationsData.filter(item => {
      const matchesCat = currentCategory === 'all' || item.cat === currentCategory;
      const matchesQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesQuery;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-8 text-center text-slate-500 text-sm">
          No se encontraron integraciones con "${searchQuery}". Puedes conectar cualquier API usando el nodo <strong class="text-brand-400">HTTP Request</strong>.
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'p-4 rounded-xl bg-dark-950/80 border border-dark-800 hover:border-dark-700 hover:bg-dark-900 transition-all duration-200 group flex flex-col justify-between';
      card.innerHTML = `
        <div>
          <div class="text-2xl mb-2">${item.icon}</div>
          <h4 class="text-xs font-bold text-white group-hover:text-brand-400 transition-colors">${item.name}</h4>
          <p class="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">${item.desc}</p>
        </div>
        <div class="mt-3 pt-2 border-t border-dark-800/80 flex items-center justify-between text-[10px] text-slate-500">
          <span class="font-mono uppercase">${item.cat}</span>
          <span class="text-emerald-400 font-semibold group-hover:underline">Conectar &rarr;</span>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      render();
    });
  }

  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active', 'bg-brand-600', 'text-white'));
      pill.classList.add('active');
      currentCategory = pill.getAttribute('data-cat');
      render();
    });
  });

  render();
}

// ==========================================
// 2. LIVE WORKFLOW SIMULATOR
// ==========================================
let isSimulating = false;

function initSimulator() {
  const runBtn = document.getElementById('run-sim-btn');
  const resetBtn = document.getElementById('reset-sim-btn');

  if (runBtn) runBtn.addEventListener('click', runWorkflowSimulation);
  if (resetBtn) resetBtn.addEventListener('click', resetSimulation);
}

function runWorkflowSimulation() {
  if (isSimulating) return;
  isSimulating = true;

  const runBtn = document.getElementById('run-sim-btn');
  const btnText = document.getElementById('sim-btn-text');
  const canvasStatus = document.getElementById('canvas-status');
  const execTimer = document.getElementById('exec-timer');

  btnText.textContent = 'Ejecutando Flujo...';
  runBtn.classList.add('opacity-80', 'cursor-not-allowed');
  canvasStatus.textContent = 'Estado: Ejecución en proceso';

  resetNodeStyles();
  clearConsole();

  const startTime = performance.now();
  const timerInterval = setInterval(() => {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    if (execTimer) execTimer.textContent = `Duración: ${elapsed}s`;
  }, 50);

  // STEP 1: Node 1 (Webhook Inbound)
  logConsole('0.00s', '⚡ [Webhook Inbound] Petición HTTP recibida en endpoint POST /api/v1/lead', 'text-brand-400');
  activateNode(1, 'Ejecutando...', 'warning');

  setTimeout(() => {
    deactivateNode(1, '200 OK', 'success');
    activateWire('wire-pulse-1');
    logConsole('0.11s', '📦 [Payload Recibido] { name: "Sofía Gómez", company: "Acme Corp", employees: 250, budget: "$25,000" }', 'text-slate-300');

    // STEP 2: Node 2 (AI Agent)
    setTimeout(() => {
      deactivateWire('wire-pulse-1');
      activateNode(2, 'Analizando...', 'warning');
      logConsole('0.22s', '🤖 [Agente IA] Evaluando perfil con modelo Claude 3.5 Sonnet & memoria pgvector...', 'text-accent-purple');

      setTimeout(() => {
        deactivateNode(2, 'Score: 92/100', 'success');
        activateWire('wire-pulse-2');
        logConsole('0.34s', '🧠 [IA Resultado] Clasificación: "Enterprise High Priority" | Probabilidad de cierre: 92%', 'text-emerald-400');

        // STEP 3: Node 3 (Router / If-Else)
        setTimeout(() => {
          deactivateWire('wire-pulse-2');
          activateNode(3, 'Evaluando...', 'warning');
          logConsole('0.42s', '⑂ [Router] Comprobando condición: ($lead.score >= 85) -> VERDADERO', 'text-amber-400');

          setTimeout(() => {
            deactivateNode(3, 'Rama True', 'success');
            activateWire('wire-pulse-3a');
            activateWire('wire-pulse-3b');
            logConsole('0.48s', '🚀 [Bifurcación] Disparando acciones concurrentes a HubSpot CRM y canal Slack #enterprise-alerts', 'text-cyan-400');

            // STEP 4: Nodes 4A & 4B (Concurrent Actions)
            setTimeout(() => {
              activateNode('4a', 'Sincronizando...', 'warning');
              activateNode('4b', 'Enviando...', 'warning');

              setTimeout(() => {
                deactivateWire('wire-pulse-3a');
                deactivateWire('wire-pulse-3b');
                deactivateNode('4a', 'Creado #94812', 'success');
                deactivateNode('4b', 'Mensaje Enviado', 'success');

                logConsole('0.62s', '🟠 [HubSpot] Contacto y oportunidad creados en pipeline Enterprise con ID #94812', 'text-cyan-300');
                logConsole('0.68s', '💬 [Slack] Notificación entregada a canal #enterprise-alerts con botones interactivos', 'text-emerald-400');
                logConsole('0.70s', '✨ [Éxito] Flujo completado satisfactoriamente sin errores en 700ms.', 'text-emerald-400 font-bold');

                clearInterval(timerInterval);
                canvasStatus.textContent = 'Estado: Completado con éxito (0.70s)';
                btnText.textContent = 'Volver a Ejecutar';
                runBtn.classList.remove('opacity-80', 'cursor-not-allowed');
                isSimulating = false;
              }, 400);

            }, 200);

          }, 250);

        }, 200);

      }, 350);

    }, 200);

  }, 300);
}

function activateNode(id, badgeText, status) {
  const el = document.getElementById(`node-${id}`);
  const badge = document.getElementById(`badge-${id}`);
  if (el) {
    el.classList.add('executing');
    el.classList.remove('executed-success');
  }
  if (badge) {
    badge.textContent = badgeText;
    badge.className = 'text-[9px] font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/40 animate-pulse';
  }
}

function deactivateNode(id, badgeText, status) {
  const el = document.getElementById(`node-${id}`);
  const badge = document.getElementById(`badge-${id}`);
  if (el) {
    el.classList.remove('executing');
    el.classList.add('executed-success');
  }
  if (badge) {
    badge.textContent = badgeText;
    badge.className = 'text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
  }
}

function activateWire(wireId) {
  const wire = document.getElementById(wireId);
  if (wire) wire.classList.remove('hidden');
}

function deactivateWire(wireId) {
  const wire = document.getElementById(wireId);
  if (wire) wire.classList.add('hidden');
}

function resetNodeStyles() {
  const nodes = ['1', '2', '3', '4a', '4b'];
  const labels = ['Listo', 'Espera', 'Espera', 'Espera', 'Espera'];

  nodes.forEach((id, index) => {
    const el = document.getElementById(`node-${id}`);
    const badge = document.getElementById(`badge-${id}`);
    if (el) {
      el.classList.remove('executing', 'executed-success');
    }
    if (badge) {
      badge.textContent = labels[index];
      badge.className = 'text-[9px] font-mono px-1.5 py-0.5 rounded bg-dark-800 text-slate-400 border border-dark-700';
    }
  });

  ['wire-pulse-1', 'wire-pulse-2', 'wire-pulse-3a', 'wire-pulse-3b'].forEach(wireId => {
    deactivateWire(wireId);
  });
}

function resetSimulation() {
  if (isSimulating) return;
  resetNodeStyles();
  clearConsole();
  logConsole('0.00s', 'Flujo reiniciado. Listo para nueva ejecución.', 'text-slate-400');
  const canvasStatus = document.getElementById('canvas-status');
  const execTimer = document.getElementById('exec-timer');
  if (canvasStatus) canvasStatus.textContent = 'Estado: Listo';
  if (execTimer) execTimer.textContent = 'Duración: 0.00s';
}

function logConsole(time, message, colorClass = 'text-slate-400') {
  const consoleBox = document.getElementById('console-logs');
  if (!consoleBox) return;

  const line = document.createElement('div');
  line.className = `${colorClass} leading-relaxed transition-all`;
  line.textContent = `[+${time}] ${message}`;
  consoleBox.appendChild(line);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

function clearConsole() {
  const consoleBox = document.getElementById('console-logs');
  if (consoleBox) consoleBox.innerHTML = '';
}

// ==========================================
// 3. NODE INSPECTOR MODAL
// ==========================================
const nodeData = {
  1: {
    title: 'Nodo 1: Webhook Inbound (Trigger)',
    subtitle: 'Endpoint HTTP /api/v1/lead',
    icon: '⚡',
    payload: {
      headers: {
        "content-type": "application/json",
        "user-agent": "Acme-Webform/2.4",
        "x-webhook-signature": "sha256=9f83a0bc8e..."
      },
      body: {
        event: "new_inbound_lead",
        contact: {
          fullName: "Sofía Gómez",
          workEmail: "sofia@acmecorp.io",
          company: "Acme Corporation",
          companySize: 250,
          annualCloudBudget: 25000,
          interestedIn: "Enterprise Multi-Region Automation"
        },
        timestamp: "2026-10-17T14:10:00Z"
      }
    }
  },
  2: {
    title: 'Nodo 2: Agente Autónomo de IA',
    subtitle: 'Motor Claude 3.5 Sonnet + RAG pgvector',
    icon: '✨',
    payload: {
      promptModel: "claude-3-5-sonnet",
      ragContextRetrieved: [
        "Criterio SQL Enterprise: >100 empleados o presupuesto >$10k anual",
        "Casos de éxito similares: Sector Logística y Finanzas"
      ],
      aiResponse: {
        leadScore: 92,
        priority: "HIGH_ENTERPRISE",
        suggestedNextSteps: "Agendar demo técnica con Solution Architect",
        summary: "Lead con alto ajuste de presupuesto y requerimiento explícito multi-región."
      }
    }
  },
  3: {
    title: 'Nodo 3: Enrutador Condicional (If / Else)',
    subtitle: 'Regla de bifurcación de datos',
    icon: '⑂',
    payload: {
      conditionExpression: "$json.aiResponse.leadScore >= 85",
      evaluation: true,
      matchedRoute: "output_branch_1 (Enterprise Priority)",
      fallbackRoute: "output_branch_2 (Self-Service Onboarding)"
    }
  },
  4: {
    title: 'Nodo 4A: HubSpot CRM Upsert',
    subtitle: 'Acción de creación de contacto y trato',
    icon: '🟠',
    payload: {
      action: "crm.contacts.upsert",
      properties: {
        email: "sofia@acmecorp.io",
        firstname: "Sofía",
        lastname: "Gómez",
        company: "Acme Corporation",
        hs_lead_status: "CONNECTED",
        deal_amount: 25000,
        deal_pipeline: "Enterprise Sales 2026"
      },
      status: "SUCCESS_201_CREATED",
      hubspotRecordId: "hs_rec_9841285"
    }
  },
  5: {
    title: 'Nodo 4B: Notificación Slack',
    subtitle: 'Alerta instantánea a #enterprise-alerts',
    icon: '💬',
    payload: {
      channel: "#enterprise-alerts",
      message: "🚨 *Nuevo Lead Enterprise Calificado (Score 92/100)*",
      blocks: [
        { type: "header", text: "Sofía Gómez — Acme Corporation (250 emp)" },
        { type: "section", text: "Presupuesto: $25,000/año | RAG: Calificado automáticamente" },
        { type: "actions", buttons: ["Ver en CRM", "Tomar contacto"] }
      ],
      deliveryStatus: "DELIVERED_200"
    }
  }
};

window.openNodeInspector = function(nodeKey) {
  const data = nodeData[nodeKey];
  if (!data) return;

  const modal = document.getElementById('node-inspector-modal');
  const title = document.getElementById('modal-title');
  const subtitle = document.getElementById('modal-subtitle');
  const icon = document.getElementById('modal-icon');
  const jsonPre = document.getElementById('modal-json');

  title.textContent = data.title;
  subtitle.textContent = data.subtitle;
  icon.textContent = data.icon;
  jsonPre.textContent = JSON.stringify(data.payload, null, 2);

  modal.classList.add('modal-open');
};

window.closeNodeInspector = function() {
  const modal = document.getElementById('node-inspector-modal');
  if (modal) modal.classList.remove('modal-open');
};

window.simulateSingleNode = function() {
  window.closeNodeInspector();
  runWorkflowSimulation();
};

// ==========================================
// 4. DOCKER QUICK COPY BUTTON
// ==========================================
function initDockerCopy() {
  const copyBtn = document.getElementById('copy-docker-btn');
  const copyText = document.getElementById('copy-text');
  const copyIcon = document.getElementById('copy-icon');
  const checkIcon = document.getElementById('check-icon');
  const tooltip = document.getElementById('copy-tooltip');

  if (!copyBtn) return;

  const command = 'docker run -it --rm --name novaflow -p 5678:5678 novaflow/novaflow';

  copyBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(command);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = command;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      copyText.textContent = '¡Copiado!';
      copyIcon.classList.add('hidden');
      checkIcon.classList.remove('hidden');
      tooltip.classList.remove('opacity-0');

      setTimeout(() => {
        copyText.textContent = 'Copiar';
        copyIcon.classList.remove('hidden');
        checkIcon.classList.add('hidden');
        tooltip.classList.add('opacity-0');
      }, 2500);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  });
}

// ==========================================
// 5. PRICING TOGGLE (Monthly / Annual)
// ==========================================
function initPricingToggle() {
  const btnMonthly = document.getElementById('btn-billing-monthly');
  const btnAnnual = document.getElementById('btn-billing-annual');
  const pricePro = document.getElementById('price-pro');

  if (!btnMonthly || !btnAnnual || !pricePro) return;

  btnMonthly.addEventListener('click', () => {
    btnMonthly.className = 'px-5 py-2 rounded-lg text-xs font-semibold bg-brand-600 text-white shadow-md transition-all';
    btnAnnual.className = 'px-5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-1.5';
    pricePro.textContent = '$29';
  });

  btnAnnual.addEventListener('click', () => {
    btnAnnual.className = 'px-5 py-2 rounded-lg text-xs font-semibold bg-brand-600 text-white shadow-md transition-all flex items-center gap-1.5';
    btnMonthly.className = 'px-5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all';
    pricePro.textContent = '$24';
  });
}

// ==========================================
// 6. ACCORDION FAQ
// ==========================================
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-btn');
    const content = item.querySelector('.faq-content');
    const chevron = item.querySelector('.faq-chevron');

    if (!btn || !content) return;

    btn.addEventListener('click', () => {
      const isHidden = content.classList.contains('hidden');

      // Close all other items
      faqItems.forEach(otherItem => {
        const otherContent = otherItem.querySelector('.faq-content');
        const otherChevron = otherItem.querySelector('.faq-chevron');
        if (otherContent) otherContent.classList.add('hidden');
        if (otherChevron) otherChevron.classList.remove('rotate-180');
      });

      if (isHidden) {
        content.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
      } else {
        content.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
      }
    });
  });
}

// ==========================================
// 7. MOBILE HAMBURGER MENU
// ==========================================
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const barsIcon = document.getElementById('menu-icon-bars');
  const closeIcon = document.getElementById('menu-icon-close');

  if (!menuBtn || !mobileMenu) return;

  menuBtn.addEventListener('click', () => {
    const isHidden = mobileMenu.classList.contains('hidden');
    if (isHidden) {
      mobileMenu.classList.remove('hidden');
      if (barsIcon) barsIcon.classList.add('hidden');
      if (closeIcon) closeIcon.classList.remove('hidden');
    } else {
      mobileMenu.classList.add('hidden');
      if (barsIcon) barsIcon.classList.remove('hidden');
      if (closeIcon) closeIcon.classList.add('hidden');
    }
  });

  // Close when clicking any menu link
  const links = mobileMenu.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
      if (barsIcon) barsIcon.classList.remove('hidden');
      if (closeIcon) closeIcon.classList.add('hidden');
    });
  });
}

// Helper to scroll to simulator
window.scrollToSim = function() {
  const el = document.getElementById('workflow-demo');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};
