const DEVICE_FINGERPRINT = "v1-7dc5fd026f92b64655ec2e9d55405fd878a9b66a389d247f05a74c1c9d65a6ec";
let activeService = "taxi";
const TOKEN_STORAGE_KEYS = {
    taxi: "snapp-report.token.taxi",
    food: "snapp-report.token.food",
};

const serviceConfig = {
    taxi: {
        title: "گزارش سفرهای اسنپ",
        subtitle: "تفکیک‌شده بر اساس سال، شهر و نوع وسیله نقلیه",
        tokenLabel: "توکن اسنپ تاکسی",
        tokenPlaceholder: "َAccess Token",
        totalLabel: "تعداد کل سفرها",
        tableTitle: "جزئیات سفرها",
        tableDescription: "گزارش تجمیعی سفرها بر اساس سال، شهر و نوع وسیله نقلیه",
        loadingTitle: "در حال دریافت سفرها",
        emptyToken: "لطفاً توکن اسنپ تاکسی را وارد کنید.",
    },
    food: {
        title: "گزارش سفارش‌های اسنپ‌فود",
        subtitle: "تفکیک‌شده بر اساس سال و شهر",
        tokenLabel: "توکن اسنپ‌فود",
        tokenPlaceholder: "َAccess Token",
        totalLabel: "تعداد کل سفارش‌ها",
        tableTitle: "جزئیات سفارش‌ها",
        tableDescription: "گزارش تجمیعی سفارش‌های تکمیل‌شده بر اساس سال و شهر",
        loadingTitle: "در حال دریافت سفارش‌ها",
        emptyToken: "لطفاً توکن اسنپ‌فود را وارد کنید.",
    },
};

function getStoredToken(service) {
    try {
        return localStorage.getItem(TOKEN_STORAGE_KEYS[service]) || "";
    } catch {
        return "";
    }
}

function saveStoredToken(service, token) {
    try {
        localStorage.setItem(TOKEN_STORAGE_KEYS[service], token);
    } catch {
        throw new Error("مرورگر اجازه ذخیره توکن در localStorage را نمی‌دهد.");
    }
}

function normalizeDigits(value) {
    return String(value)
        .replace(/[۰-۹]/g, digit => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
        .replace(/[٠-٩]/g, digit => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
}

function getPersianYear(createdAt) {
    const date = new Date(String(createdAt).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) throw new Error(`تاریخ نامعتبر دریافت شد: ${createdAt}`);

    const year = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric",
    }).format(date);
    return Number(normalizeDigits(year).match(/\d+/)?.[0]);
}

function getProxyUrl(path, params) {
    const base =
        typeof window !== "undefined" && window.location.protocol === "file:"
            ? `http://127.0.0.1:8765${path}`
            : path;
    return `${base}?${params}`;
}

async function fetchJson(url, token) {
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
    });

    if (!response.ok) {
        let message = `خطا در دریافت اطلاعات: HTTP ${response.status}`;
        try {
            const errorBody = await response.json();
            if (errorBody?.error) message = errorBody.error;
        } catch {}
        if (response.status === 401 || response.status === 403) {
            message = "توکن واردشده نامعتبر یا منقضی شده است.";
        }
        throw new Error(message);
    }
    return response.json();
}

function getTaxiCity(ride) {
    const originAddress = String(ride.origin?.formatted_address || ride.origin_formatted_address || "");
    const destinationAddress = String(ride.destination?.formatted_address || ride.destination_formatted_address || "");
    const explicitCity = `${originAddress}،${destinationAddress}`.match(
        /(?:^|[،,])\s*شهر\s+([^،,\n-]+)/
    )?.[1];
    if (explicitCity) return explicitCity.trim();

    const originPrefix = originAddress.split(/[،,\n-]/)[0].trim();
    const destinationPrefix = destinationAddress.split(/[،,\n-]/)[0].trim();
    if (originPrefix && originPrefix === destinationPrefix) return originPrefix.replace(/^شهر\s+/, "");
    if (/^تهران[،,]/.test(originAddress) || /^تهران[،,]/.test(destinationAddress)) return "تهران";

    const lat = Number(ride.origin?.lat);
    const lng = Number(ride.origin?.lng);
    if (lat >= 35.45 && lat <= 35.95 && lng >= 51.05 && lng <= 51.7) return "تهران";
    return originPrefix || destinationPrefix || "نامشخص";
}

function getTaxiVehicleType(ride) {
    const category = String(ride.service_type?.category || "");
    const serviceName = String(ride.service_type_name || ride.service_type?.name || "");
    if (category.includes("موتور") || category.includes("پیک") || /بایک|باکس/.test(serviceName)) return "موتور";
    if (category.includes("ماشین")) return "ماشین";
    return category || "نامشخص";
}

function getFoodCity(order) {
    const customerAddress = String(order.orderAddress?.address || "");
    const vendorAddress = String(order.vendorAddress || "");
    const combinedAddress = `${customerAddress}،${vendorAddress}`;
    const explicitCity = combinedAddress.match(/(?:^|[،,])\s*شهر\s+([^،,\n-]+)/)?.[1];
    if (explicitCity) return explicitCity.trim();

    const knownCities = ["تهران", "کرج", "زنجان", "رامسر", "مشهد", "شیراز", "اصفهان", "تبریز", "قم", "رشت", "اهواز"];
    for (const city of knownCities) {
        if (new RegExp(`(^|[،,]\\s*)${city}([،,]|$)`).test(combinedAddress)) return city;
    }

    const coordinatePairs = [
        [Number(order.orderAddress?.latitude), Number(order.orderAddress?.longitude)],
        [Number(order.vendorLatitude), Number(order.vendorLongitude)],
    ];
    const cityBounds = [
        ["تهران", 35.45, 35.95, 51.05, 51.7],
        ["زنجان", 36.4, 36.9, 48.2, 49.0],
        ["رامسر", 36.75, 37.05, 50.45, 50.9],
        ["مهستان", 35.7, 36.05, 50.55, 50.95],
    ];
    for (const [lat, lng] of coordinatePairs) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) continue;
        const match = cityBounds.find(([, minLat, maxLat, minLng, maxLng]) =>
            lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
        );
        if (match) return match[0];
    }

    return customerAddress.split(/[،,\n-]/)[0].trim() || vendorAddress.split(/[،,\n-]/)[0].trim() || "نامشخص";
}

async function getSnappTaxiStats(token) {
    const stats = {};
    const visitedPages = new Set();
    let params = new URLSearchParams({ page: "1", archive: "0" });
    let processedCount = 0;

    while (true) {
        const pageKey = params.toString();
        if (visitedPages.has(pageKey)) throw new Error("حلقه در صفحه‌بندی اسنپ شناسایی شد.");
        visitedPages.add(pageKey);

        const data = await fetchJson(getProxyUrl("/snapp-api", params), token);
        const payload = data?.data ?? data;
        const rides = payload?.rides;
        if (!Array.isArray(rides)) throw new Error("ساختار پاسخ اسنپ تاکسی قابل شناسایی نیست.");

        for (const ride of rides) {
            const status = Number(ride.latest_ride_status);
            if ([6, 7].includes(status) || String(ride.title || "").includes("لغو شده")) continue;
            if (!ride.created_at) continue;

            const priceIRR = Number(ride.final_price ?? 0);
            if (!Number.isFinite(priceIRR)) continue;
            const year = getPersianYear(ride.created_at);
            const city = getTaxiCity(ride);
            const vehicleType = getTaxiVehicleType(ride);
            const key = `${year}\u0000${city}\u0000${vehicleType}`;
            stats[key] ||= { year, city, vehicleType, itemCount: 0, totalToman: 0 };
            stats[key].itemCount++;
            stats[key].totalToman += priceIRR / 10;
            processedCount++;
        }

        updateLoadingStatus(`صفحه ${params.get("page")} دریافت شد — ${processedCount.toLocaleString("fa-IR")} سفر پردازش شده`);
        if (!payload.required_params || rides.length === 0) break;
        const nextParams = new URLSearchParams(payload.required_params);
        if (!nextParams.has("page")) break;
        params = nextParams;
        await new Promise(resolve => setTimeout(resolve, 120));
    }

    return Object.values(stats)
        .sort((a, b) => b.year - a.year || a.city.localeCompare(b.city, "fa") || a.vehicleType.localeCompare(b.vehicleType, "fa"))
        .map(item => ({ ...item, totalToman: Math.round(item.totalToman) }));
}

async function getSnappFoodStats(token) {
    const stats = {};
    const pageSize = 20;
    let page = 0;
    let fetchedCount = 0;
    let completedCount = 0;

    while (true) {
        const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        const data = await fetchJson(getProxyUrl("/snappfood-api", params), token);
        const payload = data?.data ?? data;
        const orders = payload?.orders;
        if (!Array.isArray(orders)) throw new Error("ساختار پاسخ اسنپ‌فود قابل شناسایی نیست.");

        for (const order of orders) {
            fetchedCount++;
            if (order.orderCanceled || !order.startedAt) continue;
            const totalPrice = Number(order.totalPrice ?? 0);
            if (!Number.isFinite(totalPrice)) continue;

            const year = getPersianYear(order.startedAt);
            const city = getFoodCity(order);
            const key = `${year}\u0000${city}`;
            stats[key] ||= { year, city, itemCount: 0, totalToman: 0 };
            stats[key].itemCount++;
            stats[key].totalToman += totalPrice;
            completedCount++;
        }

        updateLoadingStatus(`صفحه ${(page + 1).toLocaleString("fa-IR")} دریافت شد — ${completedCount.toLocaleString("fa-IR")} سفارش پردازش شده`);
        const totalAvailable = Number(payload.count ?? fetchedCount);
        const actualPageSize = Number(payload.pageSize ?? pageSize);
        if (orders.length === 0 || fetchedCount >= totalAvailable || orders.length < actualPageSize) break;
        page++;
        await new Promise(resolve => setTimeout(resolve, 120));
    }

    return Object.values(stats)
        .sort((a, b) => b.year - a.year || a.city.localeCompare(b.city, "fa"))
        .map(item => ({ ...item, totalToman: Math.round(item.totalToman) }));
}

function updateLoadingStatus(message) {
    if (typeof document === "undefined") return;
    document.getElementById("loading-message").textContent = message;
}

function getTableColumns() {
    if (activeService === "food") {
        return [
            { title: "شهر", value: item => item.city },
            { title: "مجموع هزینه", value: item => `${item.totalToman.toLocaleString("fa-IR")} تومان` },
            { title: "تعداد سفارش", value: item => item.itemCount.toLocaleString("fa-IR") },
            { title: "سال شمسی", value: item => item.year.toLocaleString("fa-IR", { useGrouping: false }) },
        ];
    }
    return [
        { title: "سال شمسی", value: item => item.year.toLocaleString("fa-IR", { useGrouping: false }) },
        { title: "شهر", value: item => item.city },
        { title: "نوع وسیله نقلیه", value: item => item.vehicleType },
        { title: "تعداد سفر", value: item => item.itemCount.toLocaleString("fa-IR") },
        { title: "مجموع هزینه", value: item => `${item.totalToman.toLocaleString("fa-IR")} تومان` },
    ];
}

function renderResults(result) {
    const columns = getTableColumns();
    const headerRow = document.getElementById("results-head");
    const tableBody = document.getElementById("results-body");
    const totalItems = result.reduce((sum, item) => sum + item.itemCount, 0);
    const totalToman = result.reduce((sum, item) => sum + item.totalToman, 0);
    const cities = new Set(result.map(item => item.city)).size;

    headerRow.replaceChildren(...columns.map(column => {
        const heading = document.createElement("th");
        heading.scope = "col";
        heading.textContent = column.title;
        return heading;
    }));
    tableBody.replaceChildren(...result.map(item => {
        const row = document.createElement("tr");
        row.append(...columns.map(column => {
            const cell = document.createElement("td");
            cell.textContent = column.value(item);
            return cell;
        }));
        return row;
    }));

    document.getElementById("total-items").textContent = totalItems.toLocaleString("fa-IR");
    document.getElementById("total-cost").textContent = `${totalToman.toLocaleString("fa-IR")} تومان`;
    document.getElementById("total-cities").textContent = cities.toLocaleString("fa-IR");
    document.getElementById("loading-state").hidden = true;
    document.getElementById("results-section").hidden = false;
    setCalculateButtonLoading(false);
}

function renderError(error) {
    document.getElementById("loading-state").hidden = true;
    document.getElementById("error-message").textContent = error.message;
    document.getElementById("error-state").hidden = false;
    setCalculateButtonLoading(false);
}

function setCalculateButtonLoading(isLoading) {
    const button = document.getElementById("calculate-button");
    button.disabled = isLoading;
    button.textContent = isLoading ? "در حال محاسبه…" : "محاسبه گزارش";
    document.querySelectorAll(".service-option").forEach(option => option.disabled = isLoading);
}

function setActiveService(service) {
    if (!serviceConfig[service] || service === activeService) return;
    activeService = service;
    const config = serviceConfig[service];

    document.body.classList.toggle("food-mode", service === "food");
    document.querySelectorAll(".service-option").forEach(button => {
        const selected = button.dataset.service === service;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    document.getElementById("dashboard-title").textContent = config.title;
    document.getElementById("dashboard-subtitle").textContent = config.subtitle;
    document.getElementById("token-label").textContent = config.tokenLabel;
    document.getElementById("token-input").placeholder = config.tokenPlaceholder;
    document.getElementById("total-items-label").textContent = config.totalLabel;
    document.getElementById("table-title").textContent = config.tableTitle;
    document.getElementById("table-description").textContent = config.tableDescription;
    document.getElementById("loading-title").textContent = config.loadingTitle;
    document.getElementById("token-input").value = getStoredToken(service);
    document.getElementById("report-panel").hidden = true;
}

async function startCalculation(event) {
    event.preventDefault();
    const tokenInput = document.getElementById("token-input");
    const token = tokenInput.value.trim().replace(/^Bearer\s+/i, "");
    const config = serviceConfig[activeService];

    document.getElementById("error-state").hidden = true;
    document.getElementById("results-section").hidden = true;
    document.getElementById("report-panel").hidden = false;

    if (!token) {
        renderError(new Error(config.emptyToken));
        tokenInput.focus();
        return;
    }

    setCalculateButtonLoading(true);
    updateLoadingStatus(`در حال اتصال به ${activeService === "food" ? "اسنپ‌فود" : "اسنپ تاکسی"}…`);
    document.getElementById("loading-state").hidden = false;

    try {
        saveStoredToken(activeService, token);
        const result = activeService === "food" ? await getSnappFoodStats(token) : await getSnappTaxiStats(token);
        renderResults(result);
    } catch (error) {
        if (error instanceof TypeError && window.location.protocol === "file:") {
            error = new Error("سرور محلی فعال نیست. ابتدا node snapp-server.js را اجرا کنید.");
        }
        renderError(error);
    }
}

if (typeof document !== "undefined") {
    document.getElementById("token-input").value = getStoredToken(activeService);
    document.getElementById("token-form").addEventListener("submit", startCalculation);
    document.querySelectorAll(".service-option").forEach(button => {
        button.addEventListener("click", () => setActiveService(button.dataset.service));
    });
}

if (typeof module !== "undefined") {
    module.exports = {
        getSnappTaxiStats,
        getSnappFoodStats,
        getStoredToken,
        saveStoredToken,
    };
}
