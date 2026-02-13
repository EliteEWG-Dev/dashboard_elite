function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function DateNowText() {
  try { return new Date().toLocaleString(); } catch(e) { return ""; }
}

/*
* nombre de BL à afficher par carte (pour éviter d’avoir des cartes trop longues) 
*/
const nbrToSlice = 4;

function GroupCardsBy4Picking(cardsData) {
  const groupedCards = [];

  cardsData.forEach(card => {
    const pickings = card.pickings || [];
    if (pickings.length === 0) {
      // Si pas de pickings, on garde la carte vide
      groupedCards.push({ ...card, pickings: [] });
    } else {
      // Découpe les pickings en tranche de 4
      for (let i = 0; i < pickings.length; i += nbrToSlice) {
        const slice = pickings.slice(i, i + nbrToSlice);
        groupedCards.push({ ...card, pickings: slice });
      }
    }
  });

  return groupedCards;
}

/**
 * Sous-card KPI : progression livraison (cancel exclus)
 * k = { total, active, done, not_done, cancel, pct }
 */
function renderProgressKpiTemplate(k) {
  if (!k) return null;

  // Aucun BL actif
  if (!k.active || k.active <= 0) {
    //reprends le template de la progress bar vide
    const emptyTpl = document.getElementById("kpi-progress-empty-template");
    return emptyTpl.content.cloneNode(true);
  }

  // reprends le template de la progress bar et le clone
  const tpl = document.getElementById("kpi-progress-template");
  const clone = tpl.content.cloneNode(true);

  // Calcule les pourcentages et la position du camion (entre 3% et 97% pour éviter de sortir du cadre)
  const pct = Math.max(0, Math.min(100, k.pct ?? 0));
  const truckLeft = Math.max(3, Math.min(97, pct + 2));

  // Cloner les éléments du template pour les manipuler
  const percentEl = clone.querySelector(".js-kpi-percent");
  const barEl = clone.querySelector(".js-kpi-bar");
  const progressEl = clone.querySelector(".js-kpi-progress");
  const truckEl = clone.querySelector(".js-kpi-truck");

  // mettre les valeurs dans le template
  percentEl.textContent = pct + "%";
  barEl.style.width = pct + "%";
  progressEl.setAttribute("aria-valuenow", pct);
  truckEl.style.left = truckLeft + "%";

  // retourne le clone du template avec les données injectées
  return clone;
}

/**
 * Sous-card KPI : confirmation client (cancel exclus)
 * k = { active, yes, no, pct }
 */
function renderCustomerConfirmationKpi(k) {
  if (!k) return "";

  if (!k.active || k.active <= 0) {
    //reprends le template de la progress bar vide
    const emptyTpl = document.getElementById("kpi-confirmation-empty-template");
    return emptyTpl.content.cloneNode(true);
  }

  // reprends le template de la confirmation client et le clone
  const template = document.getElementById("kpi-confirmation-template");
  const clone = template.content.cloneNode(true);

  // calcul les pourcentages
  const pct = Math.max(0, Math.min(100, k.pct ?? 0));

  // Récupère les éléments dans le clone
  const percentEl = clone.querySelector(".js-confirmation-percent");
  const barEl = clone.querySelector(".js-confirmation-bar");
  const progressEl = clone.querySelector(".js-confirmation-progress");

  // Injecte les valeurs
  percentEl.textContent = pct + "%";
  barEl.style.width = pct + "%";
  progressEl.setAttribute("aria-valuenow", pct);

  // Retourne le clone prêt à être injecté dans la carte
  return clone;
}

let allCardsGrouped = [];
let currentCardIndex = 0;

function renderCard(card) {
  // --- Header ---
  // Cloner le template de l'entête de la carte
  const headerTemplate = document.getElementById("card-header-template");
  const headerClone = headerTemplate.content.cloneNode(true);

  // Récupérer les éléments à remplir dans le clone
  const headerDate = headerClone.querySelector(".js-date-area");
  const headerDrivers = headerClone.querySelector(".js-drivers");
  const headerTruck = headerClone.querySelector(".js-truck");
  const headerStatusBadge = headerClone.querySelector(".js-status-badge");

  // Injecter les données de la carte dans le header
  if (headerDate) headerDate.textContent = card.date || "";
  if (headerDrivers) headerDrivers.textContent = card.drivers || "";
  if (headerTruck) headerTruck.textContent = `Camion ${card.truck || ""}`;
  if (headerStatusBadge) {
    headerStatusBadge.textContent = card.status_label || "";
    headerStatusBadge.className = "badge js-status-badge";
    headerStatusBadge.classList.add(card.status_badge_class || "text-bg-secondary");
  }

  // --- Body (pickings) ---
  // Créer un fragment pour la liste des pickings
  const bodyFragment = document.createDocumentFragment();

  // Récupérer le template de la liste des pickings
  const bodyTemplate = document.getElementById("list-group-item-template");

  // Injecter les pickings dans le body de la carte
  if (card.pickings && card.pickings.length > 0) {
    card.pickings.forEach(p => {
      const clone = bodyTemplate.content.cloneNode(true);

      const timeBadge = clone.querySelector(".js-time-badge");
      const time = clone.querySelector(".js-time");
      const name = clone.querySelector(".js-name");
      const city = clone.querySelector(".js-city");
      const bl = clone.querySelector(".js-bl");
      const row = clone.querySelector(".js-row");

      if (timeBadge) {
        timeBadge.className = "badge me-3 js-time-badge " + (p.time_badge_class || p.badge_class || "");
      }
      if (time) time.textContent = p.x_time_from || "";
      if (name) name.textContent = p.partner_name || "";
      if (city) city.textContent = p.x_city ? "• " + p.x_city : "";
      if (bl) bl.textContent = p.name || "";
      if (row) row.className = "list-group-item d-flex justify-content-between align-items-center js-row " + (p.row_class || "");

      bodyFragment.appendChild(clone);
    });
  } else {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "list-group-item text-muted";
    emptyDiv.textContent = "Aucun BL";
    bodyFragment.appendChild(emptyDiv);
  }

  // --- KPI Livraison ---
  // Afficher la progression de livraison uniquement si le statut est "en route"
  const showDeliveryProgress = (card.status === "on_the_way");
  const showConfirmProgress  = (card.status === "open" || card.status === "full");

  if (showDeliveryProgress) {
    const kpiNode = renderProgressKpiTemplate(card.kpi_progress);
    if (kpiNode) bodyFragment.appendChild(kpiNode);
  }

  if (showConfirmProgress) {
    const confirmNode = renderCustomerConfirmationKpi(card.kpi_customer_confirmation);
    if (confirmNode) bodyFragment.appendChild(confirmNode);
  }

  // --- Card wrapper ---
  const cardDiv = document.createElement("div");
  cardDiv.className = "card shadow-sm h-100";

  // Append header and body
  cardDiv.appendChild(headerClone);

  const cardBodyDiv = document.createElement("div");
  cardBodyDiv.className = "card-body";
  const listGroupDiv = document.createElement("div");
  listGroupDiv.className = "list-group list-group-flush";

  listGroupDiv.appendChild(bodyFragment);
  cardBodyDiv.appendChild(listGroupDiv);
  cardDiv.appendChild(cardBodyDiv);

  return cardDiv;
}

let allCards = []
async function refreshDeliveries() {
  try {
    const data = await fetch("/deliveries").then(r => r.json());
    allCards = data.cards || [];

    if(allCards.length === 0) {
      allCardsGrouped = [];
    } else {
      allCardsGrouped = GroupCardsBy4Picking(allCards);
    }

    // Préserver l'index courant
    if (currentCardIndex >= allCardsGrouped.length) currentCardIndex = 0;

    if (!allCardsGrouped.length) {
      // Affiche message vide si aucune carte
      const container = document.getElementById("deliveries_container");
      container.innerHTML = `
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-body text-muted">Aucune tournée pour la période.</div>
          </div>
        </div>`;
    } else {
      // Met à jour uniquement la carte courante
      updateCurrentCard();
    }

    document.getElementById("last_update").textContent =
      "Dernière mise à jour : " + DateNowText();
  } catch (e) {
    console.error(e);
    const container = document.getElementById("deliveries_container");
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-warning mb-0">Erreur lors du chargement des tournées.</div>
      </div>`;
    document.getElementById("last_update").textContent =
      "Erreur : " + DateNowText();
  }
}

let lastRenderedCardData = null;

function updateCurrentCard() {
  if (!allCardsGrouped.length) return;

  const container = document.getElementById("deliveries_container");
  const cardData = allCardsGrouped[currentCardIndex];

  // Sérialisation simple pour comparaison (tu peux adapter si tu veux ignorer certains champs)
  const cardHash = JSON.stringify(cardData);

  // Si rien n’a changé, on ne fait rien
  if (cardHash === lastRenderedCardData) return;

  lastRenderedCardData = cardHash;

  // --- DOM update comme avant ---
  let cardWrapper = container.querySelector(".col-12");
  if (!cardWrapper) {
    cardWrapper = document.createElement("div");
    cardWrapper.className = "col-12";
    container.appendChild(cardWrapper);
  }

  // Si pas de carte existante ou changement de carte, créer toute la carte
  if (!cardWrapper.firstChild) {
    const newCardNode = renderCard(cardData);
    cardWrapper.innerHTML = "";
    cardWrapper.appendChild(newCardNode);
    cardWrapper.classList.add("card-fade");
    void cardWrapper.offsetWidth;
    cardWrapper.classList.add("show");
    return;
  }

  // --- Sinon, mettre à jour seulement le contenu ---
  const cardNode = cardWrapper.firstChild;

  // Header
  cardNode.querySelector(".js-date-area").textContent = cardData.date || "";
  cardNode.querySelector(".js-drivers").textContent = cardData.drivers || "";
  cardNode.querySelector(".js-truck").textContent = `Camion ${cardData.truck || ""}`;
  const statusBadge = cardNode.querySelector(".js-status-badge");
  statusBadge.textContent = cardData.status_label || "";
  statusBadge.className = "badge js-status-badge " + (cardData.status_badge_class || "text-bg-secondary");

  // Pickings
  const listGroup = cardNode.querySelector(".list-group");
  listGroup.innerHTML = "";
  if (cardData.pickings && cardData.pickings.length) {
    cardData.pickings.forEach(p => {
      const clone = document.getElementById("list-group-item-template").content.cloneNode(true);
      const timeBadge = clone.querySelector(".js-time-badge");
      const time = clone.querySelector(".js-time");
      const name = clone.querySelector(".js-name");
      const city = clone.querySelector(".js-city");
      const bl = clone.querySelector(".js-bl");
      const row = clone.querySelector(".js-row");

      if (timeBadge) timeBadge.className = "badge me-3 js-time-badge " + (p.time_badge_class || p.badge_class || "");
      if (time) time.textContent = p.x_time_from || "";
      if (name) name.textContent = p.partner_name || "";
      if (city) city.textContent = p.x_city ? "• " + p.x_city : "";
      if (bl) bl.textContent = p.name || "";
      if (row) row.className = "list-group-item d-flex justify-content-between align-items-center js-row " + (p.row_class || "");

      listGroup.appendChild(clone);
    });
  } else {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "list-group-item text-muted";
    emptyDiv.textContent = "Aucun BL";
    listGroup.appendChild(emptyDiv);
  }

  // --- KPI Livraison ---
  if (cardData.status === "on_the_way") {
    const existingKpi = cardNode.querySelector(".js-kpi-wrapper");
    const kpiNode = renderProgressKpiTemplate(cardData.kpi_progress);

    if (existingKpi) {
      existingKpi.replaceWith(kpiNode);
    } else {
      cardNode.querySelector(".card-body").appendChild(kpiNode);
    }
  }

  // --- KPI Confirmation ---
  if (cardData.status === "open" || cardData.status === "full") {
    const existingConfirm = cardNode.querySelector(".js-confirmation-wrapper");
    const confirmNode = renderCustomerConfirmationKpi(cardData.kpi_customer_confirmation);

    if (existingConfirm) {
      existingConfirm.replaceWith(confirmNode);
    } else {
      cardNode.querySelector(".card-body").appendChild(confirmNode);
    }
  }

}


let lastRenderedCardIndex = null;

function displayCurrentCard() {
  const container = document.getElementById("deliveries_container");
  const navContainer = document.getElementById("nav_controls");

  if (!allCardsGrouped.length) return;

  const card = allCardsGrouped[currentCardIndex];

  // Vérifie si on change réellement de carte
  const isCardChanged = lastRenderedCardIndex !== currentCardIndex;

  // Créer le wrapper
  const newCardWrapper = document.createElement("div");
  newCardWrapper.className = "col-12";

  // Au lieu de innerHTML = renderCard(card)
  const cardNode = renderCard(card);
  newCardWrapper.appendChild(cardNode);


  // Vider et injecter dans le DOM
  container.innerHTML = "";
  container.appendChild(newCardWrapper);

  // Jouer l’animation uniquement si la carte change
  if (isCardChanged) {
    newCardWrapper.classList.add("card-fade");
    void newCardWrapper.offsetWidth;
    newCardWrapper.classList.add("show");
  }

  // Mettre à jour la référence
  lastRenderedCardIndex = currentCardIndex;

  // Mettre à jour le compteur
  navContainer.innerHTML =
    `<span class="text-muted mx-2" style="font-size: 1.65rem;">
      ${currentCardIndex + 1} / ${allCardsGrouped.length}
     </span>`;
}


const shownextCard = () => {
  if (!allCardsGrouped.length) return;
  
  if (currentCardIndex < allCardsGrouped.length - 1) {
    currentCardIndex++;
  } else {
    currentCardIndex = 0;
  }

  displayCurrentCard();
};

refreshDeliveries();

// ✅ Rafraîchissement tous les 10s
setInterval(refreshDeliveries, 10000);

// ✅ Changement de slide tous les 15s (décalé pour éviter les conflits)
setInterval(shownextCard, 15000);