### Cel
- Zachować tekst wewnątrz PDF (bez rasteryzacji stron).
- Wspierać 3 tryby: Compression (obniżanie jakości obrazów), Removal (usuwanie obrazów), Split (dzielenie pliku po stronach lub po rozmiarze).
- Zmiany wdrażać iteracyjnie, z możliwością szybkiego wycofania (feature flagi, małe PR-y).

### Zasady wdrożenia
- Feature flag: wybór silnika przetwarzania `engine=legacy|enhanced` (np. przez localStorage i query param). Domyślnie `legacy` do czasu zakończenia testów.
- Małe, odwracalne kroki: każdy krok kończy się działającym buildem i możliwością rollbacku.
- Testy manualne na stałym zestawie próbek PDF (tekst + obrazy, różne rozmiary i liczby stron).

### Postęp (checklista)

- [x] Naprawa builda (duplikat eksportu w `ui-controller.js`)
- [x] Uporządkowanie Service Workera (Workbox only) i ikon w `index.html`/`manifest.json`
- [x] Walidacja pliku i obsługa wyboru/dnd (`validateFile` w `app.js`)
- [x] Wiązanie zakładek z opcjami (Compression/Removal/Split)
- [x] Poprawa `parseSpeed` (usunięcie błędnego stringa w `pdf-lib`)
- [x] Poprawki IndexedDB (kolejność i transakcje w `storage-manager.js`)
- [x] Repo GitHub (prywatne) + CI (Actions: build na push/PR)

### M1: Feature flag + interfejs silnika
- [ ] Wprowadzić flagę `engine` (localStorage + query) i logowanie wybranego trybu
- [ ] Dodać `PdfEngine` (interfejs): `compress({quality})`, `removeImages()`, `split({method, pageCount?|sizeMB?})`
- [ ] Wyodrębnić aktualną ścieżkę do `legacyEngine` (status quo)
- [ ] Przełączyć `app.processPDF()` przez `engine`, domyślnie `legacy`

### M2: Removal bez rasteryzacji (zachowanie tekstu)
- [ ] Odczytać słownik zasobów stron (`/Resources`), zmapować XObject-y obrazów
- [ ] Sparsować strumienie treści i usuwać wywołania `Do /<ImageName>` (bez dotykania operatorów tekstu)
- [ ] Oczyścić nieużywane wpisy XObject w `/Resources`
- [ ] Zapisać i ręcznie zweryfikować na próbkach (tekst pozostaje, rozmiar maleje)
- [ ] Zaoszczędzić zmiany za flagą `enhanced`; przygotować fallback do `legacy`

### M3: Compression bez rasteryzacji tekstu
- [ ] Zlokalizować strumienie obrazów (Image XObject) i ich parametry (`/ColorSpace`, `/Filter`, `/BitsPerComponent`)
- [ ] Zdekodować obrazy do bitmapy w pamięci, przerekompresować do JPEG przy zadanej jakości (np. Canvas/OffscreenCanvas)
- [ ] Ponownie osadzić obraz jako nowy XObject, zaktualizować `/Resources` (mapowanie stary→nowy), pozostawiając komendy `Do` bez zmian
- [ ] Obsłużyć formaty: JPEG/JPEG2000/Flate/Indexed (best-effort, fallback do pominięcia)
- [ ] Weryfikacja jakości/rozmiaru i nienaruszenia tekstu (zestaw próbek)

### M4: Split (strony i rozmiar)
- [ ] Split po stronach: dziel na paczki N-stronicowe (pdf-lib: kopiowanie stron do nowych dokumentów)
- [ ] Split po rozmiarze: dodawaj strony iteracyjnie, zapisuj tymczasowo i obliczaj rozmiar; gdy przekracza limit, rozpocznij nowy dokument (z buforem bezpieczeństwa)
- [ ] Walidacja wejść w UI (N>0, limit MB w rozsądnych granicach)
- [ ] Testy ręczne na dokumentach o różnych rozkładach rozmiarów stron

### M5: Worker + wydajność
- [ ] Ustabilizować kolejkę zadań w Web Workerze (init, postMessage, PROGRESS/RESULT/ERROR)
- [ ] Streamowane postępy z długich operacji (Compression/Removal/Split)
- [ ] Ograniczenia pamięci (zwalnianie obiektów, chunkowanie przy split by size)

### M6: Zapisywanie i pobieranie wyników
- [ ] Ujednolicić zapis do IndexedDB (transakcje, retry, limit rozmiaru)
- [ ] Generowanie nazw plików wynikowych (tryb + parametry + timestamp)
- [ ] Przycisk „Download All” dla wielu plików (ZIP w workerze, jeśli potrzebne)

### M7: QA i DX
- [ ] Dodać katalog `samples/` (kilka publicznie dostępnych PDF-ów do testów)
- [ ] Dodać skrypt testowy dev (otwiera próbki, uruchamia tryby, loguje metryki)
- [ ] Rozszerzyć CI o szybki `npm run build` i lint (opcjonalnie unit e2e w późniejszym kroku)

### Rollback i bezpieczeństwo
- Każdy etap za flagą `engine=enhanced`; w razie problemów przełącz na `legacy` (lub wyłącz tryb w UI).
- Commity małe, izolowane; w razie regresji revert pojedynczego commita.
- W miarę potrzeb włączanie/wyłączanie konkretnych pod-funkcji przez ukryte przełączniki (np. `?no-recompress`).
