/**
 * Demo catalogue for HASI.TJ. It is inserted once (see seedCatalogProducts in
 * lib/db.ts) so that the storefront is never empty. Prices are in somoni and
 * are sample values: edit or delete them in the admin panel.
 */
export type SeedProduct = {
  slug: string;
  name: string;
  category: string; // category slug
  brand: string;
  sku: string;
  price: number;
  previousPrice?: number;
  stock: number;
  featured?: boolean;
  image: string; // file in /public/products
  short: string;
  specs: Record<string, string>;
};

const img = (name: string) => `/products/${name}.svg`;

export const seedProducts: SeedProduct[] = [
  // IP-камеры
  { slug: "hikvision-ds-2cd1043g2-liuf", name: "Hikvision DS-2CD1043G2-LIUF 4 Мп", category: "ip-kamery", brand: "Hikvision", sku: "DS-2CD1043G2-LIUF", price: 520, previousPrice: 590, stock: 14, featured: true, image: img("camera-bullet"), short: "Цилиндрическая IP-камера 4 Мп с гибридной подсветкой и микрофоном.", specs: { "Разрешение": "4 Мп (2688×1520)", "Объектив": "2.8 мм", "ИК-подсветка": "до 30 м, гибридная", "Питание": "PoE / DC 12 В", "Защита": "IP67", "Микрофон": "Встроенный" } },
  { slug: "dahua-ipc-hfw2441s-s", name: "Dahua IPC-HFW2441S-S 4 Мп", category: "ip-kamery", brand: "Dahua", sku: "IPC-HFW2441S-S", price: 470, stock: 18, image: img("camera-bullet"), short: "IP-камера 4 Мп WizSense с ИК-подсветкой 30 м.", specs: { "Разрешение": "4 Мп", "Объектив": "2.8 мм", "ИК-подсветка": "до 30 м", "Питание": "PoE / DC 12 В", "Защита": "IP67" } },
  { slug: "hikvision-ds-2cd2143g2-i", name: "Hikvision DS-2CD2143G2-I 4 Мп купольная", category: "ip-kamery", brand: "Hikvision", sku: "DS-2CD2143G2-I", price: 690, stock: 9, featured: true, image: img("camera-dome"), short: "Купольная IP-камера AcuSense с защитой от ложных срабатываний.", specs: { "Разрешение": "4 Мп", "Объектив": "2.8 мм", "ИК-подсветка": "до 30 м", "Питание": "PoE / DC 12 В", "Защита": "IP67, IK10" } },
  { slug: "dahua-ipc-hdw2849h-s-s", name: "Dahua IPC-HDW2849H-S-S 8 Мп", category: "ip-kamery", brand: "Dahua", sku: "IPC-HDW2849H-S-S", price: 880, stock: 6, image: img("camera-dome"), short: "Купольная IP-камера 8 Мп (4K) с ИК-подсветкой 40 м.", specs: { "Разрешение": "8 Мп (4K)", "Объектив": "2.8 мм", "ИК-подсветка": "до 40 м", "Питание": "PoE / DC 12 В", "Защита": "IP67" } },
  // Wi-Fi камеры
  { slug: "ezviz-c6n-wifi", name: "EZVIZ C6N 2K Wi-Fi поворотная", category: "wifi-kamery", brand: "EZVIZ", sku: "CS-C6N-A0-1C2WFR", price: 310, previousPrice: 350, stock: 25, featured: true, image: img("camera-wifi"), short: "Домашняя Wi-Fi камера 2K с поворотом и двусторонней связью.", specs: { "Разрешение": "4 Мп (2K)", "Wi-Fi": "2.4 ГГц", "Ночной режим": "до 10 м", "Звук": "Двусторонний", "Память": "microSD до 512 ГБ" } },
  { slug: "tp-link-tapo-c200", name: "TP-Link Tapo C200 Full HD Wi-Fi", category: "wifi-kamery", brand: "TP-Link", sku: "TAPO-C200", price: 190, stock: 40, image: img("camera-wifi"), short: "Недорогая Wi-Fi камера 1080p с поворотом 360° и ночным видением.", specs: { "Разрешение": "2 Мп (1080p)", "Wi-Fi": "2.4 ГГц", "Ночной режим": "до 9 м", "Звук": "Двусторонний", "Память": "microSD до 256 ГБ" } },
  { slug: "imou-ranger-2-4mp", name: "Imou Ranger 2 4 Мп Wi-Fi", category: "wifi-kamery", brand: "Imou", sku: "IPC-A42P", price: 260, stock: 22, image: img("camera-wifi"), short: "Wi-Fi камера 4 Мп с датчиком движения и сиреной.", specs: { "Разрешение": "4 Мп", "Wi-Fi": "2.4 ГГц", "Ночной режим": "до 10 м", "Звук": "Двусторонний", "Память": "microSD до 256 ГБ" } },
  // Уличные
  { slug: "hikvision-ds-2cd2t47g2-l", name: "Hikvision DS-2CD2T47G2-L ColorVu 4 Мп", category: "ulichnye-kamery", brand: "Hikvision", sku: "DS-2CD2T47G2-L", price: 940, stock: 8, featured: true, image: img("camera-bullet"), short: "Уличная камера ColorVu: цветное изображение 24/7 благодаря тёплой подсветке.", specs: { "Разрешение": "4 Мп", "Объектив": "2.8 мм", "Подсветка": "Белый свет до 40 м", "Питание": "PoE / DC 12 В", "Защита": "IP67" } },
  { slug: "dahua-ipc-hfw3249t1-as-pv", name: "Dahua IPC-HFW3249T1-AS-PV 2 Мп Full-color", category: "ulichnye-kamery", brand: "Dahua", sku: "IPC-HFW3249T1-AS-PV", price: 640, stock: 11, image: img("camera-bullet"), short: "Уличная камера с активным сдерживанием: сирена и красно-синяя подсветка.", specs: { "Разрешение": "2 Мп", "Объектив": "3.6 мм", "Подсветка": "Белый свет до 20 м", "Питание": "PoE / DC 12 В", "Защита": "IP67" } },
  { slug: "hiwatch-ds-i250m", name: "HiWatch DS-I250M 2 Мп уличная", category: "ulichnye-kamery", brand: "HiWatch", sku: "DS-I250M", price: 330, stock: 30, image: img("camera-bullet"), short: "Бюджетная уличная IP-камера 2 Мп с ИК-подсветкой 50 м.", specs: { "Разрешение": "2 Мп", "Объектив": "2.8 мм", "ИК-подсветка": "до 50 м", "Питание": "PoE / DC 12 В", "Защита": "IP67" } },
  // Для помещений
  { slug: "hikvision-ds-2cd1123g2-liu", name: "Hikvision DS-2CD1123G2-LIU 2 Мп", category: "kamery-dlya-pomeshcheniy", brand: "Hikvision", sku: "DS-2CD1123G2-LIU", price: 360, stock: 20, image: img("camera-dome"), short: "Компактная купольная камера для офиса и магазина.", specs: { "Разрешение": "2 Мп", "Объектив": "2.8 мм", "ИК-подсветка": "до 30 м", "Питание": "PoE / DC 12 В", "Микрофон": "Встроенный" } },
  { slug: "dahua-ipc-hdbw1239r-a-led", name: "Dahua IPC-HDBW1239R-A-LED 2 Мп", category: "kamery-dlya-pomeshcheniy", brand: "Dahua", sku: "IPC-HDBW1239R-A-LED", price: 345, stock: 17, image: img("camera-dome"), short: "Купольная камера с белой подсветкой и микрофоном для помещений.", specs: { "Разрешение": "2 Мп", "Объектив": "2.8 мм", "Подсветка": "Белый свет до 20 м", "Питание": "PoE / DC 12 В", "Микрофон": "Встроенный" } },
  // PTZ
  { slug: "hikvision-ds-2de2a404iw-de3", name: "Hikvision DS-2DE2A404IW-DE3 4 Мп PTZ", category: "ptz-kamery", brand: "Hikvision", sku: "DS-2DE2A404IW-DE3", price: 1650, stock: 4, featured: true, image: img("camera-ptz"), short: "Поворотная PTZ-камера с 4× оптическим зумом и автотрекингом.", specs: { "Разрешение": "4 Мп", "Зум": "4× оптический", "ИК-подсветка": "до 50 м", "Питание": "PoE+ / DC 12 В", "Защита": "IP66" } },
  { slug: "dahua-sd49225db-hny", name: "Dahua SD49225DB-HNY 2 Мп PTZ 25×", category: "ptz-kamery", brand: "Dahua", sku: "SD49225DB-HNY", price: 2480, stock: 3, image: img("camera-ptz"), short: "Скоростная PTZ-камера со Starlight и 25× оптическим зумом.", specs: { "Разрешение": "2 Мп", "Зум": "25× оптический", "ИК-подсветка": "до 100 м", "Питание": "PoE+ / AC 24 В", "Защита": "IP66" } },
  // Видеорегистраторы
  { slug: "hikvision-ds-7104ni-q1-4p", name: "Hikvision DS-7104NI-Q1/4P/M 4-канальный NVR", category: "videoregistratory", brand: "Hikvision", sku: "DS-7104NI-Q1/4P/M", price: 560, stock: 12, featured: true, image: img("recorder"), short: "IP-регистратор на 4 канала со встроенным PoE-коммутатором.", specs: { "Каналов": "4", "PoE-портов": "4", "Разрешение записи": "до 4 Мп", "HDD": "1 × SATA до 10 ТБ", "Выход": "HDMI / VGA" } },
  { slug: "hikvision-ds-7608ni-k2-8p", name: "Hikvision DS-7608NI-K2/8P 8-канальный NVR", category: "videoregistratory", brand: "Hikvision", sku: "DS-7608NI-K2/8P", price: 980, stock: 7, image: img("recorder"), short: "NVR на 8 каналов, 8 PoE-портов, запись до 8 Мп.", specs: { "Каналов": "8", "PoE-портов": "8", "Разрешение записи": "до 8 Мп", "HDD": "2 × SATA до 10 ТБ", "Выход": "HDMI 4K" } },
  { slug: "dahua-nvr4216-16p-4ks2", name: "Dahua NVR4216-16P-4KS2/L 16-канальный NVR", category: "videoregistratory", brand: "Dahua", sku: "NVR4216-16P-4KS2/L", price: 1540, stock: 5, image: img("recorder"), short: "16-канальный регистратор 4K с 16 портами PoE.", specs: { "Каналов": "16", "PoE-портов": "16", "Разрешение записи": "до 12 Мп", "HDD": "2 × SATA до 16 ТБ", "Выход": "HDMI 4K" } },
  // Комплекты
  { slug: "komplekt-4-kamery-ip-2mp", name: "Комплект видеонаблюдения IP на 4 камеры 2 Мп", category: "komplekty-videonablyudeniya", brand: "HASI", sku: "HASI-KIT-IP4-2MP", price: 2150, previousPrice: 2400, stock: 6, featured: true, image: img("kit"), short: "4 уличные IP-камеры, NVR с PoE, жёсткий диск 1 ТБ и кабель.", specs: { "Камеры": "4 × 2 Мп", "Регистратор": "NVR 4 канала PoE", "Диск": "1 ТБ", "Кабель": "UTP 4 × 20 м", "Монтаж": "Крепления в комплекте" } },
  { slug: "komplekt-8-kamer-ip-4mp", name: "Комплект видеонаблюдения IP на 8 камер 4 Мп", category: "komplekty-videonablyudeniya", brand: "HASI", sku: "HASI-KIT-IP8-4MP", price: 5200, stock: 3, image: img("kit"), short: "8 IP-камер 4 Мп, NVR 8 каналов, диск 2 ТБ — для магазина или офиса.", specs: { "Камеры": "8 × 4 Мп", "Регистратор": "NVR 8 каналов PoE", "Диск": "2 ТБ", "Кабель": "UTP 8 × 20 м", "Монтаж": "Крепления в комплекте" } },
  // Жёсткие диски
  { slug: "seagate-skyhawk-2tb", name: "Seagate SkyHawk 2 ТБ ST2000VX017", category: "zhestkie-diski", brand: "Seagate", sku: "ST2000VX017", price: 590, stock: 25, image: img("hdd"), short: "Жёсткий диск для видеонаблюдения 24/7, 2 ТБ.", specs: { "Объём": "2 ТБ", "Интерфейс": "SATA 6 Гбит/с", "Кэш": "256 МБ", "Нагрузка": "180 ТБ/год", "Формат": "3.5\"" } },
  { slug: "wd-purple-4tb", name: "WD Purple 4 ТБ WD42PURZ", category: "zhestkie-diski", brand: "Western Digital", sku: "WD42PURZ", price: 1120, stock: 14, image: img("hdd"), short: "Жёсткий диск WD Purple для систем видеонаблюдения, 4 ТБ.", specs: { "Объём": "4 ТБ", "Интерфейс": "SATA 6 Гбит/с", "Кэш": "256 МБ", "Нагрузка": "180 ТБ/год", "Формат": "3.5\"" } },
  // Кабели
  { slug: "kabel-utp-cat5e-305m", name: "Кабель UTP Cat.5e 305 м (бухта)", category: "kabeli", brand: "HASI", sku: "UTP-5E-305", price: 780, stock: 15, image: img("cable"), short: "Витая пара для IP-видеонаблюдения, медь, внутренний монтаж.", specs: { "Тип": "UTP 4 пары", "Категория": "5e", "Жила": "Медь 0.5 мм", "Длина": "305 м", "Монтаж": "Внутренний" } },
  { slug: "kabel-kgvv-rg6-100m", name: "Коаксиальный кабель RG-6 + питание 100 м", category: "kabeli", brand: "HASI", sku: "RG6-PWR-100", price: 420, stock: 18, image: img("cable"), short: "Комбинированный кабель для аналоговых и AHD камер: видео + питание.", specs: { "Тип": "RG-6 + 2×0.75", "Длина": "100 м", "Монтаж": "Уличный / внутренний" } },
  // Блоки питания
  { slug: "blok-pitaniya-12v-5a", name: "Блок питания 12 В 5 А для видеонаблюдения", category: "bloki-pitaniya", brand: "HASI", sku: "PSU-12V-5A", price: 85, stock: 50, image: img("power"), short: "Стабилизированный блок питания для камер, защита от КЗ.", specs: { "Напряжение": "12 В DC", "Ток": "5 А", "Мощность": "60 Вт", "Защита": "КЗ, перегрузка" } },
  { slug: "poe-kommutator-8-portov", name: "PoE-коммутатор 8 портов + 2 uplink", category: "bloki-pitaniya", brand: "TP-Link", sku: "TL-SF1008P", price: 640, stock: 10, image: img("power"), short: "Питание и передача данных по одному кабелю для 8 камер.", specs: { "Портов PoE": "8", "Скорость": "100 Мбит/с", "Бюджет PoE": "124 Вт", "Uplink": "2 × Gigabit" } },
  // AHD
  { slug: "ahd-kamera-2mp-ulichnaya", name: "AHD камера 2 Мп уличная цилиндрическая", category: "ahd-kamery", brand: "HiWatch", sku: "HIWATCH-AHD-2MP", price: 140, stock: 35, image: img("camera-bullet"), short: "Аналоговая HD-камера 1080p, ИК 20 м, металлический корпус.", specs: { "Разрешение": "2 Мп (1080p)", "Стандарт": "AHD/TVI/CVI/CVBS", "ИК-подсветка": "до 20 м", "Питание": "DC 12 В", "Защита": "IP66" } },
  // Для дома / бизнеса
  { slug: "komplekt-dlya-doma-2-kamery", name: "Комплект для дома: 2 камеры Wi-Fi + карта 64 ГБ", category: "kamery-dlya-doma", brand: "EZVIZ", sku: "HASI-HOME-2WIFI", price: 720, stock: 9, image: img("kit"), short: "Две Wi-Fi камеры с облаком и microSD, быстрый запуск за 10 минут.", specs: { "Камеры": "2 × 2K Wi-Fi", "Память": "microSD 64 ГБ", "Приложение": "EZVIZ (iOS/Android)", "Монтаж": "Крепления в комплекте" } },
  { slug: "reshenie-dlya-magazina-4-kamery", name: "Решение для магазина: 4 камеры + регистратор", category: "kamery-dlya-biznesa", brand: "HASI", sku: "HASI-SHOP-4", price: 3400, stock: 5, image: img("kit"), short: "Готовое решение: 4 камеры с микрофоном, NVR, диск 2 ТБ.", specs: { "Камеры": "4 × 4 Мп с микрофоном", "Регистратор": "NVR 8 каналов PoE", "Диск": "2 ТБ", "Установка": "По запросу" } },
  // Аксессуары
  { slug: "kronshteyn-dlya-kamery", name: "Кронштейн для цилиндрической камеры", category: "aksessuary", brand: "HASI", sku: "BRK-BULLET", price: 35, stock: 80, image: img("accessory"), short: "Металлический кронштейн для настенного монтажа камеры.", specs: { "Материал": "Алюминий", "Нагрузка": "до 3 кг", "Монтаж": "Стена / потолок" } },
  { slug: "montazhnaya-korobka-universalnaya", name: "Монтажная коробка влагозащищённая", category: "aksessuary", brand: "HASI", sku: "BOX-IP66", price: 45, stock: 60, image: img("accessory"), short: "Герметичная коробка IP66 для соединений и разъёмов.", specs: { "Защита": "IP66", "Материал": "ABS-пластик", "Размер": "100 × 100 мм" } },
];
