/** Контакты магазина — единый источник для страницы /contact, футера и кнопки WhatsApp. */
export const SITE_PHONES = [
  { display: "+992 93-333-51-11", tel: "+992933335111" },
  { display: "+992 98-551-00-99", tel: "+992985510099" },
] as const;

/** Номер WhatsApp: +992 93 333 51 11. */
export const WHATSAPP_URL = "https://wa.me/992933335111";
export const WHATSAPP_GREETING = "Здравствуйте! Хочу уточнить по поводу заказа/товара.";
export const whatsappLink = (text: string = WHATSAPP_GREETING) => `${WHATSAPP_URL}?text=${encodeURIComponent(text)}`;

/**
 * Адрес шоурума. TODO: впишите точную улицу и ориентир в SHOWROOM_STREET
 * (например "ул. Рудаки, 10, рядом с …") — он появится на /contact и в футере.
 */
export const SHOWROOM_CITY = "г. Худжанд";
export const SHOWROOM_STREET = "";
export const SHOWROOM_ADDRESS = SHOWROOM_STREET ? `${SHOWROOM_CITY}, ${SHOWROOM_STREET}` : SHOWROOM_CITY;
