# Открытые замечания к состояниям

Сгенерировано из `ui/data/remarks.json` командой `pnpm remarks:md`. Этот Markdown не редактируется вручную. Номера строк вычисляются по селекторам в исходниках.

- Замечание — блок «Первый экран», элемент .hero__card::before: Узлы Figma 27:1990 и 70:921 используют Glass (radius 25, refraction 0.8). CSS воспроизводит размытие и заливку; преломление отличается, поскольку прямого аналога Glass в браузере нет.; backdrop-filter: blur(25px) и заливка из макета. [events/detail/assets/scss/blocks/hero.scss:30](assets/scss/blocks/hero.scss#L30)
- Замечание — блок «Форма регистрации», элемент .contact-form: Итоговые панели Figma 3473:845 и 3473:983 используют Glass с radius 38 и refraction 0.8 без отдельной обводки. CSS blur(38px) не воспроизводит преломление и световой кант Glass.; Сохранены заливка, размеры и размытие; эффект преломления имеет ограничение браузера.. [events/detail/assets/scss/blocks/contact-form.scss:3](assets/scss/blocks/contact-form.scss#L3)
- Замечание — блок «Общий подвал», элемент .footer: Высота общего подвала 417px вместо 416px на 1920 и 1082px вместо 1072.6328125px на 390. Источники: 2002:2487, 2002:2434; начало подвала совпадает.; Общий подвал сохранён согласно границам задачи.. [assets/scss/blocks/footer.scss:4](../../assets/scss/blocks/footer.scss#L4)
