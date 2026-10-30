"use client";

import { whatsappLink } from "@/lib/site-contacts";

/**
 * Плавающая кнопка WhatsApp в правом нижнем углу — рядом с кнопкой
 * онлайн-чата администратора (MyMessagesWidget).
 * Видна на публичных страницах (главная, каталог, карточка товара и др.);
 * на /admin не рендерится, т.к. размещается внутри публичного шаблона SiteShell.
 */
export function WhatsAppFloat() {
  return (
    <div className="fixed bottom-20 right-[76px] z-[95] sm:bottom-6 sm:right-[88px]">
      <a
        href={whatsappLink()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Написать в WhatsApp"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-[0_8px_30px_rgba(34,197,94,0.35)] ring-4 ring-emerald-600/15 transition duration-200 hover:scale-105 hover:bg-emerald-500 active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
          <path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 0 0 5.6 1.4C18.6 23.7 24 18.4 24 11.8c0-3.2-1.2-6.1-3.5-8.3ZM12 21.7a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.800 1 1-3.700-.2-.4a9.800 9.800 0 0 1-1.500-5.200c0-5.400 4.400-9.800 9.900-9.800 2.600 0 5.100 1 6.900 2.900a9.700 9.700 0 0 1 2.900 6.900c0 5.400-4.500 9.900-9.800 9.900Zm5.400-7.400c-.3-.1-1.800-.9-2-1-.3-.1-.5-.1-.7.100l-1 1.200c-.2.200-.4.200-.6.100a8 8 0 0 1-4-3.500c-.3-.5.300-.5.900-1.600.1-.2 0-.4 0-.5l-.9-2.100c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.100-.8.400-.3.300-1 1-1 2.500s1.100 2.900 1.200 3.100c.2.200 2.100 3.300 5.200 4.600 1.900.800 2.700.900 3.600.700.600-.100 1.800-.700 2-1.500.3-.700.300-1.300.2-1.500-.1-.1-.3-.2-.6-.4Z" />
        </svg>
        <span
          className="absolute top-1/2 right-full -translate-y-1/2 mr-3 whitespace-nowrap rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 shadow group-hover:opacity-100 sm:text-xs"
        >
          WhatsApp
        </span>
      </a>
    </div>
  );
}
