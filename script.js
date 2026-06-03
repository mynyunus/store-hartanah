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

const TESTIMONIAL_IMAGE_NAMES = [
  "WhatsApp Image 2026-06-02 at 12.40.58 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.40.58 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.40.59 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.40.59 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.40.59 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.00 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.00 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.01 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.01 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.02 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.02 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.02 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.03 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.03 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.04 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.04 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.41.04 AM.jpeg",
];

const SOLD_IMAGE_NAMES = [
  "WhatsApp Image 2026-06-02 at 12.42.02 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.02 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.02 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.03 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.03 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.04 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.04 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.04 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.05 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.05 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.05 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.06 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.06 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.07 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.07 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.07 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.08 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.08 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.08 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.09 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.09 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.10 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.10 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.10 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.11 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.12 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.12 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.12 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.13 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.13 AM (2).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.13 AM.jpeg",
];

const SOLD_IMAGE_PRIORITY = [
  "WhatsApp Image 2026-06-02 at 12.42.03 AM (1).jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.03 AM.jpeg",
  "WhatsApp Image 2026-06-02 at 12.42.02 AM.jpeg",
];

const parseDatedImageName = (name) => {
  const match = name.match(
    /(\d{4})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2}) (AM|PM)(?: \((\d+)\))?/i
  );

  if (!match) {
    return {
      timestamp: Number.MIN_SAFE_INTEGER,
      variant: Number.MAX_SAFE_INTEGER,
    };
  }

  const [, year, month, day, hourText, minute, second, meridiem, variantText] = match;
  let hour = Number(hourText);
  const upperMeridiem = meridiem.toUpperCase();

  if (upperMeridiem === "AM" && hour === 12) hour = 0;
  if (upperMeridiem === "PM" && hour !== 12) hour += 12;

  return {
    timestamp: new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      hour,
      Number(minute),
      Number(second)
    ).getTime(),
    variant: variantText ? Number(variantText) : 0,
  };
};

const sortImageNamesByDate = (names) =>
  [...names].sort((left, right) => {
    const leftParsed = parseDatedImageName(left);
    const rightParsed = parseDatedImageName(right);

    if (leftParsed.timestamp !== rightParsed.timestamp) {
      return rightParsed.timestamp - leftParsed.timestamp;
    }

    if (leftParsed.variant !== rightParsed.variant) {
      return leftParsed.variant - rightParsed.variant;
    }

    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  });

const sortSoldImageNames = (names) => {
  const sourceOrder = new Map(names.map((name, index) => [name, index]));
  const priorityOrder = new Map(SOLD_IMAGE_PRIORITY.map((name, index) => [name, index]));

  return [...names].sort((left, right) => {
    const leftPriority = priorityOrder.get(left);
    const rightPriority = priorityOrder.get(right);

    if (leftPriority !== undefined && rightPriority !== undefined) {
      return leftPriority - rightPriority;
    }

    if (leftPriority !== undefined) return -1;
    if (rightPriority !== undefined) return 1;

    return (sourceOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (sourceOrder.get(right) ?? Number.MAX_SAFE_INTEGER);
  });
};

const bindSwipeNavigation = (element, onPrev, onNext) => {
  if (!element) return;
  let startX = 0;
  let startY = 0;
  let active = false;

  element.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      active = true;
    },
    { passive: true }
  );

  element.addEventListener(
    "touchend",
    (event) => {
      if (!active) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      active = false;

      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY)) return;
      if (deltaX < 0) onNext();
      else onPrev();
    },
    { passive: true }
  );
};

const initImageCarousel = ({
  rootSelector,
  imageBasePath,
  imageNames,
  sortNames = sortImageNamesByDate,
  imageAltPrefix,
  lightboxSelector,
  lightboxImageSelector,
  lightboxCountSelector,
  lightboxStageSelector,
  lightboxPrevSelector,
  lightboxNextSelector,
}) => {
  const root = document.querySelector(rootSelector);
  if (!root) return;

  const imageSources = sortNames(imageNames).map((name) => `${imageBasePath}/${encodeURIComponent(name)}`);
  if (!imageSources.length) return;

  const carousel = document.createElement("div");
  carousel.className = "testimonial-carousel";

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "testimonial-nav prev";
  prevButton.setAttribute("aria-label", "Gambar sebelumnya");
  prevButton.textContent = "‹";

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "testimonial-nav next";
  nextButton.setAttribute("aria-label", "Gambar seterusnya");
  nextButton.textContent = "›";

  const viewport = document.createElement("div");
  viewport.className = "testimonial-viewport";

  const track = document.createElement("div");
  track.className = "testimonial-track";

  imageSources.forEach((src, idx) => {
    const slide = document.createElement("figure");
    slide.className = "testimonial-slide";

    const frame = document.createElement("div");
    frame.className = "testimonial-frame";

    const image = document.createElement("img");
    image.src = src;
    image.alt = `${imageAltPrefix} ${idx + 1}`;
    image.loading = idx === 0 ? "eager" : "lazy";
    image.decoding = "async";
    image.dataset.testimonialIndex = String(idx);
    image.tabIndex = 0;

    frame.appendChild(image);
    slide.appendChild(frame);
    track.appendChild(slide);
  });

  viewport.appendChild(track);
  carousel.appendChild(prevButton);
  carousel.appendChild(viewport);
  carousel.appendChild(nextButton);

  const indicator = document.createElement("div");
  indicator.className = "testimonial-indicator";

  const indicatorText = document.createElement("span");
  indicatorText.className = "testimonial-indicator-text";

  const indicatorBar = document.createElement("div");
  indicatorBar.className = "testimonial-indicator-bar";

  const indicatorFill = document.createElement("span");
  indicatorFill.className = "testimonial-indicator-fill";
  indicatorBar.appendChild(indicatorFill);

  indicator.appendChild(indicatorText);
  indicator.appendChild(indicatorBar);

  root.appendChild(carousel);
  root.appendChild(indicator);

  const lightbox = document.querySelector(lightboxSelector);
  const lightboxImage = document.querySelector(lightboxImageSelector);
  const lightboxCount = document.querySelector(lightboxCountSelector);
  const lightboxStage = document.querySelector(lightboxStageSelector);
  const lightboxPrev = document.querySelector(lightboxPrevSelector);
  const lightboxNext = document.querySelector(lightboxNextSelector);
  const lightboxClose = lightbox?.querySelector(".testimonial-lightbox-close");

  let activeIndex = 0;
  let lightboxIndex = 0;

  const goTo = (index) => {
    const total = imageSources.length;
    activeIndex = (index + total) % total;
    track.style.transform = `translateX(-${activeIndex * 100}%)`;
    indicatorText.textContent = `${activeIndex + 1} / ${total}`;
    indicatorFill.style.width = `${((activeIndex + 1) / total) * 100}%`;
  };

  const updateLightbox = () => {
    if (!lightbox || !lightboxImage || !lightboxCount) return;
    const total = imageSources.length;
    lightboxIndex = (lightboxIndex + total) % total;
    lightboxImage.src = imageSources[lightboxIndex];
    lightboxCount.textContent = `${lightboxIndex + 1} / ${total}`;
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.hidden = true;
    body.classList.remove("lightbox-open");
  };

  const openLightbox = (index) => {
    if (!lightbox) return;
    lightboxIndex = index;
    updateLightbox();
    lightbox.hidden = false;
    body.classList.add("lightbox-open");
  };

  prevButton.addEventListener("click", () => goTo(activeIndex - 1));
  nextButton.addEventListener("click", () => goTo(activeIndex + 1));

  track.addEventListener("click", (event) => {
    const image = event.target.closest("img[data-testimonial-index]");
    if (!image) return;
    openLightbox(Number(image.dataset.testimonialIndex || 0));
  });

  track.addEventListener("keydown", (event) => {
    const image = event.target.closest("img[data-testimonial-index]");
    if (!image) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openLightbox(Number(image.dataset.testimonialIndex || 0));
  });

  if (lightboxPrev) {
    lightboxPrev.addEventListener("click", () => {
      lightboxIndex -= 1;
      updateLightbox();
    });
  }

  if (lightboxNext) {
    lightboxNext.addEventListener("click", () => {
      lightboxIndex += 1;
      updateLightbox();
    });
  }

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (!lightbox || lightbox.hidden) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") {
      lightboxIndex -= 1;
      updateLightbox();
    }
    if (event.key === "ArrowRight") {
      lightboxIndex += 1;
      updateLightbox();
    }
  });

  bindSwipeNavigation(viewport, () => goTo(activeIndex - 1), () => goTo(activeIndex + 1));
  bindSwipeNavigation(
    lightboxStage,
    () => {
      lightboxIndex -= 1;
      updateLightbox();
    },
    () => {
      lightboxIndex += 1;
      updateLightbox();
    }
  );

  goTo(0);
};

const initTestimonialCarousel = () =>
  initImageCarousel({
    rootSelector: "[data-testimonial-carousel-root]",
    imageBasePath: "assets/testimoni",
    imageNames: TESTIMONIAL_IMAGE_NAMES,
    imageAltPrefix: "Gambar testimoni pelanggan",
    lightboxSelector: "[data-testimonial-lightbox]",
    lightboxImageSelector: "[data-testimonial-lightbox-image]",
    lightboxCountSelector: "[data-testimonial-lightbox-count]",
    lightboxStageSelector: "[data-testimonial-lightbox-stage]",
    lightboxPrevSelector: "[data-testimonial-lightbox-prev]",
    lightboxNextSelector: "[data-testimonial-lightbox-next]",
  });

const initSoldCarousel = () =>
  initImageCarousel({
    rootSelector: "[data-sold-carousel-root]",
    imageBasePath: "assets/sold",
    imageNames: SOLD_IMAGE_NAMES,
    sortNames: sortSoldImageNames,
    imageAltPrefix: "Gambar rekod jualan Store Hartanah",
    lightboxSelector: "[data-sold-lightbox]",
    lightboxImageSelector: "[data-sold-lightbox-image]",
    lightboxCountSelector: "[data-sold-lightbox-count]",
    lightboxStageSelector: "[data-sold-lightbox-stage]",
    lightboxPrevSelector: "[data-sold-lightbox-prev]",
    lightboxNextSelector: "[data-sold-lightbox-next]",
  });

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
initTestimonialCarousel();
initSoldCarousel();
initListings();
