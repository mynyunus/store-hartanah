const body = document.body;
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const backdrop = document.querySelector("[data-menu-backdrop]");
const navLinks = document.querySelectorAll("a[href^='#']");
const faqItems = document.querySelectorAll("[data-faq-item]");
const yearEl = document.getElementById("year");

const LISTING_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1KUE6Yt0FS0d8revKLuXdcnD_9VEbafewkLcMMzptixc/edit?gid=0#gid=0";
const LISTING_WHATSAPP_BASE = "https://wa.me/60133459365";
const LISTING_DEFAULT_MESSAGE =
  "Hai Mizz Rashidah, saya berminat untuk dapatkan cadangan rumah ikut bajet saya.";

const setMenu = (open) => {
  if (!menuToggle || !mobileMenu) return;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
  body.classList.toggle("menu-open", open);
};

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    setMenu(!isOpen);
  });
}

if (backdrop) {
  backdrop.addEventListener("click", () => setMenu(false));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

faqItems.forEach((item, index) => {
  const button = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");
  if (!button || !answer) return;

  const answerId = `faq-answer-${index + 1}`;
  button.setAttribute("aria-controls", answerId);
  answer.id = answerId;
  answer.style.maxHeight = "0px";

  button.addEventListener("click", () => {
    const isExpanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!isExpanded));

    if (isExpanded) {
      answer.style.maxHeight = "0px";
      return;
    }

    answer.style.maxHeight = `${answer.scrollHeight}px`;
  });
});

const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

const sections = Array.from(document.querySelectorAll("main section[id]"));
const desktopNav = document.querySelectorAll("[data-desktop-nav] a[href^='#']");

if (sections.length && desktopNav.length && "IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute("id");
        desktopNav.forEach((link) => {
          const active = link.getAttribute("href") === `#${id}`;
          link.classList.toggle("active", active);
        });
      });
    },
    { threshold: 0.5 }
  );

  sections.forEach((section) => sectionObserver.observe(section));
}

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const listingCache = {
  promise: null,
  data: null,
};

const safeValue = (value) => (value == null ? "" : String(value).trim());

const parseSheetInfo = (sheetUrl) => {
  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = sheetUrl.match(/[?#&]gid=([0-9]+)/);
  return {
    spreadsheetId: idMatch ? idMatch[1] : "",
    gid: gidMatch ? gidMatch[1] : "0",
  };
};

const parseCSV = (csvText) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
};

const parseGviz = (rawText) => {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1) return [];

  const json = JSON.parse(rawText.slice(start, end + 1));
  const cols = (json.table?.cols || []).map((col) => safeValue(col.label || col.id));
  const rows = json.table?.rows || [];

  return rows.map((row) =>
    cols.map((_, colIndex) => {
      const cell = row.c?.[colIndex];
      if (!cell) return "";
      if (cell.f != null) return String(cell.f);
      if (cell.v == null) return "";
      return String(cell.v);
    })
  ).length
    ? [cols, ...rows.map((row) =>
        cols.map((_, colIndex) => {
          const cell = row.c?.[colIndex];
          if (!cell) return "";
          if (cell.f != null) return String(cell.f);
          if (cell.v == null) return "";
          return String(cell.v);
        })
      )]
    : [];
};

const extractUrls = (raw) => {
  const value = safeValue(raw);
  if (!value || value === "0") return [];

  const urlMatches = value.match(/https?:\/\/[^\s|,;]+/g);
  if (urlMatches && urlMatches.length) return urlMatches;

  return value
    .split(/[\n|,;]+/)
    .map((item) => safeValue(item))
    .filter(Boolean);
};

const normalizeDriveUrl = (url) => {
  const cleanUrl = safeValue(url).replace(/&amp;/g, "&");
  if (!cleanUrl) return "";

  if (/drive\.google\.com\/(thumbnail|uc)/.test(cleanUrl)) {
    const idMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1600`;
    return cleanUrl;
  }

  const driveIdMatch =
    cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (driveIdMatch) {
    return `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w1600`;
  }

  return cleanUrl;
};

const parsePriceNumber = (priceText) => {
  const cleaned = safeValue(priceText).replace(/,/g, "");
  const numeric = cleaned.replace(/[^0-9.]/g, "");
  const value = Number(numeric);
  return Number.isFinite(value) ? value : null;
};

const buildFallbackWhatsappText = (listing) => {
  const lines = ["Hai Mizz Rashidah, saya berminat dengan unit ini:"];
  if (listing.title) lines.push(`• ${listing.title}`);
  if (listing.location) lines.push(`• Lokasi: ${listing.location}`);
  if (listing.price) lines.push(`• Harga: ${listing.price}`);
  lines.push("Boleh saya dapatkan butiran penuh?");
  return lines.join("\n");
};

const buildWhatsappLink = (listing) => {
  const customText = safeValue(listing.whatsappText);
  const message = customText && customText !== "0" ? customText : buildFallbackWhatsappText(listing);
  return `${LISTING_WHATSAPP_BASE}?text=${encodeURIComponent(message || LISTING_DEFAULT_MESSAGE)}`;
};

const normalizeListingRows = (rows) => {
  if (!rows.length) return [];

  const headers = rows[0].map((header) => safeValue(header).toLowerCase().replace(/\s+/g, "_"));

  return rows
    .slice(1)
    .map((row) => {
      const source = {};
      headers.forEach((header, index) => {
        source[header] = safeValue(row[index]);
      });

      const title = source.title;
      const description = source.description;
      const location = source.location;
      const price = source.price;
      const statusRaw = source.status;
      const status = statusRaw === "0" ? "" : statusRaw;
      const whatsappText = source.whatsapp_text;

      if (!title && !description && !location && !price) return null;

      const imageUrls = extractUrls(source.image_url)
        .map((url) => normalizeDriveUrl(url))
        .filter(Boolean);

      return {
        title: title || "Listing Tanpa Tajuk",
        description,
        location,
        price,
        priceValue: parsePriceNumber(price),
        status,
        imageUrls,
        whatsappText,
      };
    })
    .filter(Boolean);
};

const fetchSheetRows = async () => {
  const { spreadsheetId, gid } = parseSheetInfo(LISTING_SHEET_URL);
  if (!spreadsheetId) return [];

  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?gid=${gid}&tqx=out:json`;

  try {
    const csvResponse = await fetch(csvUrl, { cache: "no-store" });
    if (csvResponse.ok) {
      const csvText = await csvResponse.text();
      const rows = parseCSV(csvText);
      if (rows.length > 1) return rows;
    }
  } catch (_) {
    // Continue to fallback source.
  }

  try {
    const gvizResponse = await fetch(gvizUrl, { cache: "no-store" });
    if (!gvizResponse.ok) return [];
    const gvizText = await gvizResponse.text();
    return parseGviz(gvizText);
  } catch (_) {
    return [];
  }
};

const getListings = async () => {
  if (listingCache.data) return listingCache.data;
  if (!listingCache.promise) {
    listingCache.promise = fetchSheetRows().then((rows) => {
      listingCache.data = normalizeListingRows(rows);
      return listingCache.data;
    });
  }
  return listingCache.promise;
};

const renderListingCard = (listing) => {
  const card = document.createElement("article");
  card.className = "listing-card";
  card.dataset.location = (listing.location || "").toLowerCase();
  card.dataset.status = (listing.status || "").toLowerCase();
  card.dataset.title = (listing.title || "").toLowerCase();
  card.dataset.description = (listing.description || "").toLowerCase();
  card.dataset.priceValue = listing.priceValue == null ? "" : String(listing.priceValue);

  const imageList = listing.imageUrls.length
    ? listing.imageUrls
    : ["https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1000&q=80&fm=webp"];

  const media = document.createElement("div");
  media.className = "listing-media";
  media.dataset.images = JSON.stringify(imageList);
  media.dataset.imageIndex = "0";

  const image = document.createElement("img");
  image.src = imageList[0];
  image.alt = listing.title;
  image.loading = "lazy";
  image.width = 1000;
  image.height = 667;
  media.appendChild(image);

  if (listing.status) {
    const statusBadge = document.createElement("span");
    statusBadge.className = "listing-status";
    statusBadge.textContent = listing.status;
    media.appendChild(statusBadge);
  }

  if (imageList.length > 1) {
    const counter = document.createElement("span");
    counter.className = "listing-counter";
    counter.textContent = `1 / ${imageList.length}`;
    media.appendChild(counter);

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "listing-gallery-btn prev";
    prevBtn.dataset.galleryPrev = "true";
    prevBtn.setAttribute("aria-label", "Gambar sebelumnya");
    prevBtn.textContent = "‹";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "listing-gallery-btn next";
    nextBtn.dataset.galleryNext = "true";
    nextBtn.setAttribute("aria-label", "Gambar seterusnya");
    nextBtn.textContent = "›";

    media.appendChild(prevBtn);
    media.appendChild(nextBtn);
  }

  const content = document.createElement("div");
  content.className = "listing-content";

  const title = document.createElement("h3");
  title.textContent = listing.title;
  content.appendChild(title);

  if (listing.description) {
    const description = document.createElement("p");
    description.className = "listing-description";
    description.textContent = listing.description;
    content.appendChild(description);
  }

  const meta = document.createElement("div");
  meta.className = "listing-meta";
  if (listing.location) {
    const location = document.createElement("span");
    location.textContent = listing.location;
    meta.appendChild(location);
  }
  if (listing.price) {
    const price = document.createElement("span");
    price.className = "listing-price";
    price.textContent = listing.price;
    meta.appendChild(price);
  }
  if (meta.children.length) content.appendChild(meta);

  const action = document.createElement("a");
  action.className = "btn btn-primary";
  action.href = buildWhatsappLink(listing);
  action.target = "_blank";
  action.rel = "noopener noreferrer";
  action.textContent = "Tanya Unit Ini";
  content.appendChild(action);

  card.appendChild(media);
  card.appendChild(content);
  return card;
};

const populateFilterOptions = (listings) => {
  const locationSelect = document.querySelector("[data-filter-location]");
  const statusSelect = document.querySelector("[data-filter-status]");

  if (locationSelect) {
    const locations = [...new Set(listings.map((item) => item.location).filter(Boolean))].sort();
    locations.forEach((location) => {
      const option = document.createElement("option");
      option.value = location;
      option.textContent = location;
      locationSelect.appendChild(option);
    });
  }

  if (statusSelect) {
    const statuses = [...new Set(listings.map((item) => item.status).filter(Boolean))].sort();
    statuses.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      statusSelect.appendChild(option);
    });
  }
};

const applyListingFilters = (listings) => {
  const searchInput = document.querySelector("[data-filter-search]");
  const locationSelect = document.querySelector("[data-filter-location]");
  const statusSelect = document.querySelector("[data-filter-status]");
  const minPriceInput = document.querySelector("[data-filter-price-min]");
  const maxPriceInput = document.querySelector("[data-filter-price-max]");

  const searchQuery = safeValue(searchInput?.value).toLowerCase();
  const locationQuery = safeValue(locationSelect?.value).toLowerCase();
  const statusQuery = safeValue(statusSelect?.value).toLowerCase();
  const minPrice = Number(minPriceInput?.value || 0);
  const maxPrice = Number(maxPriceInput?.value || 0);

  return listings.filter((listing) => {
    const haystack = [listing.title, listing.description, listing.location].join(" ").toLowerCase();
    if (searchQuery && !haystack.includes(searchQuery)) return false;

    if (locationQuery && safeValue(listing.location).toLowerCase() !== locationQuery) return false;
    if (statusQuery && safeValue(listing.status).toLowerCase() !== statusQuery) return false;

    if (Number.isFinite(minPrice) && minPrice > 0) {
      if (listing.priceValue == null || listing.priceValue < minPrice) return false;
    }

    if (Number.isFinite(maxPrice) && maxPrice > 0) {
      if (listing.priceValue == null || listing.priceValue > maxPrice) return false;
    }

    return true;
  });
};

const renderListingGrid = (grid, listings) => {
  const limitValue = Number(grid.dataset.listingLimit || 0);
  const renderItems = limitValue > 0 ? listings.slice(0, limitValue) : listings;

  grid.innerHTML = "";
  renderItems.forEach((listing) => {
    grid.appendChild(renderListingCard(listing));
  });

  const emptyNotice = grid.parentElement?.querySelector("[data-listing-empty]");
  if (emptyNotice) {
    emptyNotice.hidden = renderItems.length > 0;
  }
};

const updateListingCount = (count) => {
  const countTarget = document.querySelector("[data-listing-count]");
  if (countTarget) {
    countTarget.textContent = `${count} unit dijumpai`;
  }
};

const setupListingFilters = (listings) => {
  const filterForm = document.querySelector("[data-listing-filter]");
  const listingGrid = document.querySelector("[data-listing-grid-all]");

  if (!filterForm || !listingGrid) return;

  const rerender = () => {
    const filtered = applyListingFilters(listings);
    renderListingGrid(listingGrid, filtered);
    updateListingCount(filtered.length);
  };

  filterForm.addEventListener("input", rerender);
  filterForm.addEventListener("change", rerender);

  const resetButton = filterForm.querySelector("[data-filter-reset]");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      filterForm.reset();
      rerender();
    });
  }

  rerender();
};

const setupGalleryControls = () => {
  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-gallery-prev], [data-gallery-next]");
    if (!control) return;

    const media = control.closest(".listing-media");
    if (!media) return;

    const image = media.querySelector("img");
    const counter = media.querySelector(".listing-counter");
    const imageSet = JSON.parse(media.dataset.images || "[]");
    if (!image || imageSet.length < 2) return;

    const currentIndex = Number(media.dataset.imageIndex || 0);
    const nextIndex = control.dataset.galleryNext
      ? (currentIndex + 1) % imageSet.length
      : (currentIndex - 1 + imageSet.length) % imageSet.length;

    image.src = imageSet[nextIndex];
    media.dataset.imageIndex = String(nextIndex);
    if (counter) counter.textContent = `${nextIndex + 1} / ${imageSet.length}`;
  });
};

const initListings = async () => {
  const grids = document.querySelectorAll("[data-listing-grid]");
  if (!grids.length) return;

  const listings = await getListings();
  grids.forEach((grid) => {
    if (grid.hasAttribute("data-listing-grid-all")) return;
    renderListingGrid(grid, listings);
  });

  const listingGridAll = document.querySelector("[data-listing-grid-all]");
  if (listingGridAll) {
    populateFilterOptions(listings);
    setupListingFilters(listings);
  }
};

setupGalleryControls();
initListings();
