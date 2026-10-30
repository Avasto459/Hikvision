# Шаг 1 — схема БД v2 (по ТЗ HASI.TJ)

Файлы:
- `lib/db/schema-v2.ts` — таблицы v2, миграция из прежней схемы, seed профиля HASI.
- `lib/db/order-number.ts` — генератор `HASI-YYYYMMDD-NNN` (атомарный счётчик по дням, дата по Душанбе).

Подключение (Шаг 2): в `initializeSchema()` после создания базовых таблиц вызвать `await ensureV2Schema(db)`
и удалить старый блок `hasiTables`. Сейчас файлы НЕ подключены — прежний код работает со старой схемой.

## Таблицы v2 (как в ТЗ)
distributors, warehouses, offers, dealer_identity, dealer_limits, stock_movements, customer_orders, sales, settlements, commissions
+ products.distributor_id, products.warehouse_id (specifications и images уже были).

## Что добавлено сверх ТЗ (колонки помечены «ДОП.» в коде)
| Таблица | Колонки | Зачем |
|---|---|---|
| distributors | user_id | связь с аккаунтом роли DISTRIBUTOR («только свои предложения») |
| dealer_identity | passport_scan_url / _mime / _data | скан паспорта (вы просили ранее), виден только админу |
| stock_movements | order_id | выдача «под ID заказа» |
| customer_orders | customer_address, customer_city, comment, picked_up_at, cancelled_at, cancel_reason | форма checkout и статусы accepted → picked_up → sold / cancelled |
| sales | purchase_total | сколько освободить в used_amount при оплате складу |
| order_counters (новая) | day, last | уникальные номера HASI-YYYYMMDD-NNN без дублей |

## Миграция
Прежние таблицы с теми же именами (camelCase) переименовываются в `legacy_<имя>`, данные переносятся:
заявки (items → JSON, статусы free/accepted/picked_up/sold/cancelled), продажи, комиссии, движения, лимиты
(`used_amount` = закупка по незакрытым выдачам), паспортные данные (→ JSON в `passport_data`), офферы (из `offers_stock`).
Всё в одной транзакции, повторный запуск безопасен. Таблицы `legacy_*` можно удалить после проверки.

## Ограничения в БД
один профиль HASI (`is_hasi=1`), CHECK на статусы заявок, `used_amount >= 0`, `stock >= 0`, UNIQUE(order_number), UNIQUE(sales.order_id).

## Дилер: «Создать новый заказ» (кабинет /dealer/dashboard)
- `GET /api/dealer/products/available` — товары с остатком > 0 на центральном складе и услуги (только роль DEALER).
- `POST /api/dealer/orders/create` — заказ дилера для покупателя: уникальный номер, статус «Принята дилером», цены и остатки проверяются на сервере.
- Модалка `components/dealer-order-modal.tsx`: сетка товаров с фото (ProductImage), поиск, корзина с количеством и «×», автоматический итог.

## Паспорт: две стороны, камера телефона
- Загружаются обе стороны (лицевая и оборотная): `passportScan` / `passportScanBack` в multipart-запросе `POST /api/admin/dealers` и `PATCH /api/admin/dealers/:id`; просмотр — `GET /api/admin/dealers/:id/passport?side=front|back` (только админ).
- Форма: «Снять камерой» (на телефоне открывает камеру) или «Выбрать файл» (JPG, PNG, WEBP, PDF). Фото автоматически уменьшается до 1800 px / JPEG, чтобы пройти лимит Vercel (2 МБ на файл).
- Колонки: `dealer_identity.passportBackUrl / passportBackMime / passportBackData`; в `schema-v2.ts` — `passport_back_*`.

## Отмена, возврат и удаление заявок
- Дилер: `POST /api/dealer/orders/:id/cancel`. «Принята дилером» → «Отменена»; «Товар выдан» → «Возврат на проверке» (возврат подтверждает админ).
- Админ: `POST /api/admin/hasi/orders/:id {action:"cancel"}` — отмена; для выданного товара: остаток возвращается на склад (движение `return`), продажа и комиссии отменяются, лимит дилера освобождается. `DELETE /api/admin/hasi/orders/:id` — полное удаление (позиции, продажа, расчёты, комиссии; движения склада остаются в журнале). Нельзя удалить заказ, по которому дилеру уже выплачена доля.
- Страница `/admin/orders`; все действия пишутся в журнал активности.

## Контакты и условия
- `lib/site-contacts.ts` — два телефона, WhatsApp, адрес шоурума (впишите улицу в `SHOWROOM_STREET`).
- `components/trust-info.tsx` — блоки «Доставка / Оплата / Гарантия» на карточке товара и в оформлении заказа.
- Разовая миграция цены комплекта «4 камеры + регистратор/NVR» (тестовые 300 → 3000 сомони, только если цена < 1000).
