# super-token-saver

**Jedyna wtyczka Claude Code, która naprawdę czyta kod źródłowy CC, aby znaleźć, gdzie trafiają Twoje tokeny — i automatycznie to naprawia. Wydawaj mniej, koduj dłużej.**

> Zmierzony wynik: **45% redukcja kosztów** przy rzeczywistym obciążeniu $326/dzień → $180/dzień. Automatyczne delegowanie do SubTask, bezkosztowe przywracanie kontekstu, pełny panel analityczny i zabezpieczenie przed wygasaniem cache — w jednej instalacji, zero konfiguracji.

Działa z **Max Plan ($200/miesiąc)** i **API płatność za użycie**. Ta sama wtyczka, te same funkcje. Silniejsze dla każdego użytkownika — szczególnie gdy każdy token to prawdziwe pieniądze.

![Panel użycia — zobacz dokładnie, gdzie trafiają Twoje tokeny](docs/images/usage-view-overview.png)

### Co robi w 30 sekund

| Funkcja | Co się dzieje | Wpływ |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Automatycznie deleguje ciężką pracę do SubTask (37,5% tańszy cache) | Kontekst pozostaje mały, koszty spadają |
| 🪶 Concise Mode | Usuwa wypełnienie odpowiedzi, zachowuje treść | Mniej tokenów wyjściowych na odpowiedź |
| 🔄 /s-continue | Zastępuje /compact — zero wywołań LLM, zero kosztu, zero utraty informacji, a do tego przywraca też sesje **Codex** | Bezpłatne przywracanie kontekstu w obu narzędziach |
| 🤝 /s-compact | Zapisuje przekazanie sesji, które /s-continue automatycznie wczytuje — przechwytuje ustalenia subagentów i wyniki narzędzi, które transkrypt traci | Kolejna sesja wznawia się także z ukrytym kontekstem |
| 📊 Status Line | Koszt w czasie rzeczywistym, rozmiar kontekstu, limit szybkości — poniżej 50ms | Widzisz problemy zanim staną się kosztowne |
| 📈 /usage-view | Interaktywny panel HTML z analizą AI | Pełna analiza kosztów jednym kliknięciem |
| ✂️ /setup-git-lite | Usuwa 2200 ukrytych tokenów wstrzykiwanych przez CC w każdej sesji | ~$48/miesiąc oszczędności tylko na instrukcjach git |
| 🛡️ Token Guardian | Ostrzega Cię w momencie, gdy wygasanie cache ponownie wysyła Twój kontekst, lub blokuje to w trybie `block` | Koniec cichych niespodzianek za $9 |

---

## 😤 Problem

**Niewidoczne koszty.** Brak widoczności w czasie rzeczywistym. Żadnego ostrzeżenia „Twój kontekst wynosi 800K". Żadnego alertu „cache wygasł 3 minuty temu". Dowiadujesz się po fakcie.

**Rozrośnięty kontekst.** Ten sam prompt przy 200K kontra 800K kontekście kosztuje 4x więcej. Każde Read, Grep, Edit ponownie wysyła pełny kontekst. Jeden złożony prompt wyzwala 15+ wywołań API, każde pomnożone przez rozmiar kontekstu.

**Wygasanie cache.** Wracasz po obiedzie. Cache znikł. Jeden prompt ponownie wysyła 900K tokenów po pełnej cenie. $9 za jednym razem.

**Wszystko ręcznie.** Zarządzanie kontekstem, czas wygasania cache, delegowanie do SubTask, czyszczenie sesji. Nikt nie jest w stanie śledzić tego wszystkiego, jednocześnie faktycznie kodując.

**Max Plan ($200/miesiąc)?** Wszystko powyższe, plus 5-godzinny limit szybkości, który zatrzymuje Twój przepływ bez timera i bez szacowanego czasu.

**API płatność za użycie?** Wszystko powyższe, z wyjątkiem braku górnego limitu. Jeden chybiony cache = $9 prawdziwych pieniędzy. Dziesięć razy w tygodniu = $360/miesiąc tylko na przypadkach. Zły wtorek z rozrośniętym kontekstem może kosztować więcej niż subskrybent Max Plan płaci przez miesiąc.

super-token-saver obsługuje to wszystko automatycznie. **Zainstaluj raz. Gotowe.**

---

## 🚀 Instalacja

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Działa automatycznie po instalacji. Zero konfiguracji. Wymaga [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Dla monitorowania na żywo:

```
/setup-statusline install
```

Aby przyciąć 2200 ukrytych tokenów z wbudowanych instrukcji git CC ([szczegóły](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Funkcja 1: Inteligentna architektura sesji

**Zainstaluj i automatycznie uruchamiają się wzorce pracy zoptymalizowane pod kątem kosztów.**

Większość użytkowników robi wszystko w sesji Main. Czytanie plików, generowanie kodu, uruchamianie testów. Każde wyjście nakłada się na kontekst i jest ponownie wysyłane z każdą wiadomością. Sesja puchnie. Koszty narastają lawinowo.

Session Architect automatycznie wstrzykuje strategię delegowania na początku sesji.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rola             | Projektowanie, decyzje, przegląd  | Implementacja, generowanie kodu, wiele plików |
| Warstwa cache    | 1 godzina (ephemeral_1h)          | 5 minut                               |
| Koszt zapisu cache | ＄10/MTok                        | ＄6.25/MTok                            |
| Rozmiar kontekstu | ~94K średnio                     | ~33K średnio                          |

SubTask ma **37,5% tańszy zapis cache** niż Main. Kontekst jest też znacznie mniejszy. Delegowanie ciężkiej pracy do SubTask drastycznie obniża koszty.

**Wynik:** Kontekst pozostaje poniżej 250K zamiast rosnąć do 600K+. Taki sam wynik pracy, połowa kosztów tokenów. W pełni automatyczny.

---

## 🪶 Concise Mode

**Ta sama treść. Mniej wypełnienia. Domyślnie włączony.**

Hook SessionStart wstrzykuje również regułę stylu odpowiedzi działającą w **każdej sesji i każdym modelu** — bez flag, bez konfiguracji. Trzy rzeczy się zmieniają:

- **Brak wstępów** — żadnego „Pozwól, że sprawdzę…", „Teraz zrobię…", powtarzania Twojego pytania ani streszczania tego, co diff już pokazuje
- **Właściwy format dla treści** — punkty dla list, proza dla rozumowania (kompromisy, przyczynowość, uzasadnienie). Żadne nie jest wymuszone
- **Zwięzlejsze wyrażenie** — ten sam punkt, mniej słów. Jaśniejsza proza jest krótszą prozą

Twardy limit: nigdy nie pomijaj treści, weryfikacji ani nie spłaszczaj niuansów do jednego zdania. Istota pozostaje pełna; tylko opakowanie się kurczy.

Zainstaluj raz, stosuje się wszędzie.

---

## 🔄 Funkcja 2: /s-continue — Przywracanie kontekstu

**Zastępuje `/compact`. Zero wywołań LLM. Zero kosztów tokenów. Zero utraty informacji.**

`/compact` wysyła cały kontekst (~1M tokenów) do LLM, aby skompresować go do 3,3% streszczenia. Jeśli cache wygasł, samo to wywołuje pełne ponowne cachowanie. Utrata informacji jest nieunikniona.

`/s-continue` przyjmuje zupełnie inne podejście. Wstępnie przetwarza poprzedni transkrypt sesji i ładuje go bezpośrednio. Brak wywołania LLM. Brak kosztu. Oryginalna rozmowa zostaje przywrócona w niezmienionej postaci.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Jak działa              | Wysyła pełny kontekst do LLM w celu podsumowania | Wstępnie przetwarza transkrypt, odczytuje bezpośrednio |
| Wywołania LLM           | Wymagane (zazwyczaj 100K+ tokenów) | 0                               |
| Koszt tokenów           | Wysoki                            | 0                                |
| Utrata informacji       | Tak (streszczenie 3,3%)           | Brak (oryginał zachowany)        |
| Szybkość przetwarzania  | Dziesiątki sekund                 | < 1 sek (nawet pliki 60MB+)      |
| Gdy cache wygasł        | Dodatkowy koszt pełnego ponownego cachowania | Brak wpływu              |
| Przywracanie wielu sesji | Niemożliwe                       | Obsługiwane                      |

Użycie: `/clear` następnie `/s-continue`. Zobaczysz listę poprzednich sesji. Wybierz jedną do przywrócenia. Dla szybkiego odtworzenia: `/s-continue last`.

**Wynik:** Wznów poprzednią pracę bez żadnych kosztów. Brak utraty informacji. Przetwarza transkrypty 60MB+ w mniej niż 1 sekundę.

### 🤝 Jego para: `/s-compact` — przekazanie ukrytej warstwy

`/s-continue` przywraca **transkrypt** — to, co powiedzieliście ty i Claude. Ale najbardziej przydatna
wiedza z sesji roboczej często żyje POZA tym dialogiem: co znalazł **subagent** (jego transkrypt to
osobny plik, którego przywracanie nigdy nie wczytuje), decydująca **liczba w wyniku narzędzia** (liczba
testów, wynik benchmarku), **wniosek wyciągnięty z procesu** ("nie udało się odtworzyć w trybie
headless → problem był w buildzie, nie w kodzie").

Uruchom `/s-compact` na **końcu** sesji, a destyluje dokładnie tę ukrytą warstwę w przekazanie,
zapisane w `~/.claude/super-token-saver-data/<project>/handoff.md`. W kolejnej sesji
`/s-continue` **automatycznie wczytuje** je na wierzchu przywróconego transkryptu — bez wklejania.

|                     | Samo `/s-continue`              | `/s-compact` + `/s-continue` (para)             |
| ------------------- | -------------------------------- | ------------------------------------------------ |
| Odzyskuje           | Transkrypt (co zostało powiedziane) | Transkrypt **plus** ukryta warstwa             |
| Ustalenia subagentów | Utracone (osobne pliki)         | Zdestylowane w przekazaniu                        |
| Liczby z wyników narzędzi | Tylko jeśli zacytowane w czacie | Wyodrębnione celowo                          |
| Wnioski z procesu   | —                                 | Zachowane, aby ślepych zaułków nie powtarzać      |

**Przebieg pracy:** zakończ sesję poleceniem `/s-compact` → rozpocznij kolejną poleceniem `/s-continue`.


### 🔀 Jedna historia dla obu narzędzi — tu przywrócisz też sesje Codex

Codex zapisuje swoje sesje w `~/.codex/sessions/`, Claude Code — w `~/.claude/projects/`. Żadne z nich nie odczytuje plików drugiego. Dlatego sprint, w którym w Codex skończył się budżet, był nieosiągalny z poziomu Claude Code — i odwrotnie.

`/s-continue` pokazuje teraz i przywraca sesje z obu narzędzi. Rollout z Codex nie trafia do drugiego parsera — jest przepisywany do dokładnie tej postaci, w jakiej zapisuje Claude Code, **jedna linia wyjściowa na jedną linię wejściową**, dzięki czemu ten sam pipeline obsługuje oba narzędzia, a każdy znacznik `L{n}` nadal wskazuje dokładnie tę samą linię oryginalnego pliku Codex. Zmierzone: rollout 12 MB, 1,540-line, jest wstępnie przetwarzany w **0.13 s**.

|                          | Sesja Claude Code | Sesja Codex |
| ------------------------ | -------------------- | -------------- |
| Widoczna w `/s-continue` | Tak | Tak, ograniczona do bieżącego projektu |
| Przywracana bez kosztów LLM | Tak | Tak |
| Przeskok `L{n}` do oryginału | Tak | Tak — numery linii pochodzą z samego rollout'u |
| Przywracanie po utracie kontekstu (`#0`) | `/compact`, auto-compact | Kompaktowanie Codex i cofnięcie wątku |
| Przekazanie `/s-compact` | Współdzielone per projekt — zapisz w jednym narzędziu, wczytaj w drugim |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Dwa szczegóły decydują o różnicy między poprawną listą a błędną, choć wiarygodnie wyglądającą: `session_id` w Codex to id **wątku**, które dziedziczy każdy uruchomiony subagent, więc sesje są indeksowane po `payload.id`, a rollouty subagentów są odfiltrowywane tak samo, jak Claude Code odfiltrowuje już własne transkrypty podzadań. A `<codex_internal_context source="goal">` jest wstawiane maszynowo, więc pozostaje w przywróconym kontekście, ale nigdy nie liczy się jako tura, którą wpisałeś.

Wtyczka instaluje się też w Codex — zobacz **[README-CODEX.md](./README-CODEX.md)**
([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)).
`usage-view`, `report-limit` i `setup-statusline` na razie pozostają wyłącznie dla Claude Code.

---

## 📊 Funkcja 3: Pasek stanu na żywo

**Monitorowanie tokenów/kosztów w czasie rzeczywistym. Narzut poniżej 50ms.**

Uruchom `/setup-statusline install` raz i na dole Claude Code pojawi się trwały pasek stanu.

**Normalna praca** — każda metryka na pierwszy rzut oka, zero przełączania kontekstu:

![Pasek stanu w normalnym stanie](docs/images/statusline-normal.png)

**Osiągnięty limit szybkości** — 5H staje się czerwone przy 102%, odliczanie pokazuje dokładnie, kiedy wrócisz, a jednorazowa akcja `/report-limit` pojawia się automatycznie:

![Pasek stanu przy limicie szybkości](docs/images/statusline-rate-limited.png)

| Wskaźnik         | Co pokazuje                         | 🟢 Normalny | 🟡 Ostrzeżenie | 🔴 Krytyczny |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Koszt ostatniego wywołania API      | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | Skumulowany koszt dla tego folderu  | —         | —          | —           |
| 5H               | Użycie okna 5-godzinnego + odliczanie do resetu | < 70%     | >= 70%     | >= 90%      |
| CTX              | Użycie okna kontekstu               | < 35%     | >= 35%     | >= 70%      |

Gdy dowolny wskaźnik osiągnie poziom ostrzeżenia lub krytyczny, automatycznie pojawia się wskazówka `→ /usage-view current`.

Aby usunąć: `/setup-statusline uninstall` (poprzednia konfiguracja jest automatycznie przywracana).

**Wynik:** Każdy problem z kosztami widoczny w czasie rzeczywistym. Narzut poniżej 50ms — żadnego zauważalnego opóźnienia.

> **Korzystasz z API płatności za użycie?** Wskaźniki 5H i W automatycznie się ukrywają — nie masz okien limitu szybkości. To, co pozostaje, jest ważne: RUN (koszt w czasie rzeczywistym na turę) i CTX (rozmiar kontekstu). Dwie dźwignie kontrolujące Twój rachunek, zawsze widoczne.

---

## 📈 Panel użycia (/usage-view)

**Wreszcie odpowiedz: „Gdzie poszły te wszystkie pieniądze?"**

Użytkownicy Max Plan napotykają limit szybkości i zastanawiają się dlaczego. Użytkownicy API otwierają fakturę Anthropic i zastanawiają się jak. W każdym przypadku pytanie jest takie samo: która sesja spaliła najwięcej tokenów? Kiedy koszty skoczyły? Jakie wzorce istnieją w Twoim użytkowaniu? Do tej pory — wszystko niewidoczne.

`/usage-view` pokazuje wszystko. Interaktywny panel HTML otwiera się w przeglądarce, pozwalając analizować wzorce użycia i śledzić przyczynę źródłową skoków kosztów. Brak zewnętrznych zależności. Działa samodzielnie. Można udostępniać jako plik.

**$4196 w 31 dni. Gdzie to wszystko poszło?** Jedno spojrzenie — łączny koszt, podział tokenów według typu, wskaźnik wydajności cache i liczba sesji. Wykres pierścieniowy natychmiast pokazuje, że 65% wydatków to odczyty cache (co jest normalne i zdrowe):

![Przegląd panelu użycia](docs/images/usage-view-overview.png)

**Przed i po — zmierzone, nie zgadywane.** Pomarańczowy przerywany znacznik „Plugin installed" dzieli oś czasu kosztów na dwie części. Dzienne słupki są ułożone według typu tokenu (Input/Output/Cache Write/Cache Read), dzięki czemu możesz zobaczyć dokładnie, który element zmienił się po instalacji. Linia średniej pokazuje trend:

![Dzienny trend kosztów](docs/images/usage-view-daily-trend.png)

**Kiedy spalasz najwięcej?** Koszt godzinowy według pory dnia i podział według dnia tygodnia. Przełączaj między średnią aktywnych dni, średnią wszystkich dni lub maksimum. Ikony ognia oznaczają Twoje najdroższe godziny — wyraźne wzorce (nocne maraton kodowania, skoki w środę) wychodzą natychmiast:

![Godzinowy wzorzec kosztów i wzorzec według dnia tygodnia](docs/images/usage-view-hourly-pattern.png)

**Czy stajesz się bardziej wydajny?** Wskaźnik Total/Output mierzy, ile tokenów jest zużywanych na każdy wyprodukowany token wyjściowy. Niższy jest lepszy. Znacznik „Plugin installed" pozwala porównać przed i po. Skoki = chybione cache lub restarty sesji:

![Trend wydajności](docs/images/usage-view-efficiency.png)

**Każde wywołanie API, zaznaczone według rozmiaru kontekstu i kosztu.** To jest wykres, który sprawia, że struktura kosztów staje się jasna. Każda kropka to jedno wywołanie API. Czerwony = Opus, niebieski = Sonnet, zielony = Haiku. Przerywane linie to teoretyczne ceny — jeśli Twoje kropki leżą powyżej linii, płacisz za dużo. Przełącz na widok **User Turn**, aby zobaczyć koszt na turę rozmowy zamiast na wywołanie API.
Najedź na dowolną kropkę, aby zobaczyć rzeczywisty tekst promptu, liczbę tokenów i pełny podział kosztów (Input/Output/Cache Write/Cache Read):

![Koszt według rozmiaru kontekstu — wykres rozrzutu](docs/images/usage-view-cost-scatter.png)

**Jak duże są Twoje konteksty?** Większość wywołań skupia się poniżej 250K. Długi ogon powyżej 350K to miejsce, gdzie koszty eksplodują — ten wykres pokazuje dokładnie, jak często jesteś w strefie niebezpiecznej:

![Rozkład rozmiaru kontekstu](docs/images/usage-view-context-dist.png)

**Twój harmonogram kodowania, wyceniony godzinowo.** Mapa cieplna okna 5-godzinnego przez 30 dni. Zielony (<$15/h), pomarańczowy ($15-30/h), czerwony ($30+/h). Ikona czaszki (💀) oznacza okna, w których osiągnąłeś limit szybkości. Suwak kosztów na górze filtruje tanie okna, żeby drogie wyskoczyły — przeciągnij, aby natychmiast znaleźć swoje najgorsze dni. Przełączaj między widokiem okna 5-godzinnego i bloków 1-godzinnych:

![Mapa cieplna kalendarza użycia godzinowego](docs/images/usage-view-calendar.png)

**Kliknij dowolną komórkę, aby wejść w szczegóły sesji w tym oknie.** Każda sesja w tym przedziale czasowym, z kosztami, liczbą wiadomości, podziałem tokenów i rzeczywistymi pierwszymi/ostatnimi wiadomościami z każdej rozmowy. Rozwiń „Top Token Conversations", aby zobaczyć, które konkretne wymiany spaliły najwięcej — każdy wpis pokazuje tekst promptu, tagi alertów kosztów i wskazówki optymalizacyjne:

![Panel szczegółów sesji](docs/images/usage-view-session-drilldown.png)

**Analiza oparta na AI (opcjonalnie).** Gdy uruchamiasz `/usage-view` bez `--no-ai`, analityk AI czyta wszystkie dane Twojego panelu — z wbudowanym odniesieniem do cen API — i tworzy pisemny raport: czynniki kosztu, anomalie, zalecenia optymalizacyjne. Wyświetlany automatycznie w języku Twojego systemu operacyjnego (23 języki, z RTL włącznie; wykresy/tabele zawsze pozostają LTR):

**Gdzie poszły pieniądze** — łączne wydatki, czynniki kosztu według typu tokenu, tygodniowy trend i wpływ wtyczki mierzony w rzeczywistych liczbach:

![Analiza AI — podział kosztów](docs/images/usage-view-ai-report-1.png)

**Kiedy i jak pracujesz** — godziny szczytu, najbardziej pracowite dni, rozkład wywołań API i wzorce limitów szybkości ujawniające możliwości optymalizacji:

![Analiza AI — wzorce pracy](docs/images/usage-view-ai-report-2.png)

**Co z tym zrobić** — konkretne, poparte danymi zalecenia dostosowane do Twojego faktycznego użycia. Przełączanie modeli, zarządzanie kontekstem, strategia sesji:

![Analiza AI — zalecenia](docs/images/usage-view-ai-report-3.png)

**Udostępnij to.** Cały panel to jeden samodzielny plik HTML — wszystkie dane wbudowane, serwer nie jest potrzebny. Wyślij do swojego zespołu, menedżera lub księgowego. Brak zewnętrznych zależności. Działa offline. Użyj trybu `private`, aby usunąć cały tekst promptu przed udostępnieniem — zachowuje analizy kosztów przy usuwaniu treści rozmowy.

```
/usage-view                  # Cały czas, wszystkie projekty
/usage-view current          # Tylko bieżące okno 5-godzinne
/usage-view last 7 days      # Ostatnie 7 dni
/usage-view locale ja        # Japoński
/usage-view --no-ai          # Pomiń analizę AI (szybciej)
/usage-view private          # Usuń tekst promptu (bezpieczny do udostępniania)
```

---

## 🔬 Badania limitu szybkości (/report-limit)

**Projekt napędzany przez społeczność, aby metodą inżynierii wstecznej ustalić formułę limitu szybkości.**

Anthropic nie publikuje dokładnej formuły okna 5-godzinnego. Ustalmy to razem.

Gdy osiągniesz limit szybkości, uruchom `/report-limit`. Twoje bieżące dane użycia są automatycznie przesyłane jako GitHub Discussion. Im więcej danych zebramy, tym wyraźniejsza stanie się formuła.

---

## ✂️ Funkcja 4: /setup-git-lite — Przytnij wbudowane instrukcje git CC

**Przeczytaliśmy kod źródłowy Claude Code. Znaleźliśmy 2200 ukrytych tokenów wstrzykiwanych w każdej sesji, za które po cichu płacisz.**

### Odkrycie

W 2026-04-12 [zgłoszenie na GitHub](https://github.com/anthropics/claude-code/issues/47107) ujawniło, że wbudowane ustawienie `includeGitInstructions` w Claude Code po cichu spala tokeny w każdej sesji. Niezależna reprodukcja przez [ten gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) potwierdziła liczby: **+6031 tokenów w zapisach cache** na sesję po każdym commicie git, **+1690 tokenów w odczytach cache** przy każdym wywołaniu API.

### Analiza źródła CC — gdzie trafiają tokeny

Prześledziśliśmy tokeny do dwóch niezależnych punktów wstrzyknięcia w kodzie źródłowym Claude Code (v2.1.88):

**1. Migawka `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` zbiera gałąź + główną gałąź + user.name + pełny status (do 2000 znaków) + **ostatnie 5 commitów**
- Łączone i dołączane do system prompt przez `appendSystemContext` (`utils/api.ts:437`)
- Każdy nowy commit, każdy nowo zmodyfikowany plik, każde przełączenie gałęzi zmienia tekst → unieważnienie cache prefiksu

**2. Instrukcje przepływu pracy Commit/PR (~1700 tok) — opis narzędzia Bash**
- `tools/BashTool/prompt.ts:53` dołącza 60+ linii protokołu bezpieczeństwa, krok po kroku procedury commitowania, przykłady HEREDOC i szablony tworzenia PR do opisu narzędzia `Bash`
- Buforowane razem z system prompt, ale wysyłane jako parametr `tools[]`

### Dlaczego to drogie

Struktura cache (`utils/api.ts:321` `splitSysPromptPrefix`) ma trzy ścieżki w zależności od tego, czy masz aktywne narzędzia MCP:

- **Ścieżka A** (MCP aktywne — większość użytkowników): `gitStatus` siedzi w bloku `cacheScope: 'org'`. Jakakolwiek zmiana → cały blok jest ponownie cachowany przy następnym starcie sesji → 6K tok `cache_create` miss.
- **Ścieżka B** (brak MCP): `gitStatus` trafia do dynamicznego bloku `cacheScope: null`, co oznacza, że jest ponownie wysyłane jako świeże `input_tokens` przy każdym wywołaniu API — brak miss cache, ale też brak oszczędności cache.
- **Ścieżka C** (dostawca zewnętrzny / wyłączone bety eksperymentalne): tak samo jak Ścieżka A.

W typowych sesjach interaktywnych instrukcje commit/PR (1,7K tok) kumulują się **przy każdym wywołaniu API** przez `cache_read`. W sesji 100 wywołań przy cenach Opus 4.7 to mniej więcej **$0,08 na sesję** tylko za instrukcje, które trening Claude'a i tak w większości pokrywa.

### Jak super-token-saver sobie z tym radzi

`/setup-git-lite` wyłącza natywną ścieżkę i wstrzykuje **wyselekcjonowane 280-tokenowe zastępstwo** przez hook SessionStart. Zachowaliśmy dokładnie to, co nadpisuje domyślne zachowanie Claude'a (reguły bezpieczeństwa) i odrzuciliśmy wszystko, co Claude już wie z treningu (krok po kroku przepływy pracy, szablony PR, wzorce użycia gh).

**Zachowane — 11 kluczowych reguł nadpisujących** (te, które zamieniają domyślną pomocność Claude'a w ostrożność):
- Nigdy nie commituj/pushuj/amenduj/PR/tag/merge bez wyraźnego żądania użytkownika
- Nigdy nie pomijaj hooków, nie wymuszaj push do main/master, nie uruchamiaj destrukcyjnych operacji, nie modyfikuj git config
- Nigdy nie commituj plików pasujących do `.env`, `credentials`, `*.pem`, `secret.*`
- Unikaj `git add -A` / `git add .`
- HEREDOC dla wieloliniowych wiadomości commit + trailer `Co-Authored-By: Claude`
- Nigdy nie używaj interaktywnych flag (-i), brak pustych commitów
- Jeśli hook pre-commit zakończy się niepowodzeniem → utwórz NOWY commit (nie `--amend`)

**Usunięte** — krok po kroku przepływ pracy commit (3 kroki), krok po kroku przepływ pracy PR (3 kroki), szablon tytułu/treści PR, odniesienia do komend `gh`, ostrzeżenie o fladze `-uall`, ostrzeżenie `--no-edit` z rebase, ograniczenie `NEVER use TodoWrite or Agent tools during commit`. To szczegółowość przepływu pracy, którą Claude poprawnie komponuje samodzielnie z treningu.

**Dodane** — kompaktowa linia stanu git: gałąź + skrócone HEAD sha + temat + bieżący status (do 20 zmodyfikowanych plików, inaczej licznik). Brak listy ostatnich commitów (Claude może uruchomić `git log` na żądanie).

### Oczekiwane oszczędności (ceny Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok odczyt cache)

| Pozycja | Oryginalnie | Z setup-git-lite | Oszczędności |
| ---- | -------- | ------------------- | ----- |
| Ładowanie system prompt (na nową sesję) | ~2200 tok cache_create | ~280 tok cache_create | ~1920 tok |
| Powtórne wywołania w tej samej sesji | ~1700 tok cache_read/wywołanie | ~280 tok cache_read/wywołanie | ~1420 tok/wywołanie |
| Sesja 100 wywołań (Opus 4.7) | — | — | **~$0,11 oszczędności** |
| 20 sesji/dzień × 22 dni robocze | — | — | **~$48 oszczędności/miesiąc** |

### Użycie

```bash
/setup-git-lite status     # Diagnostyka tylko do odczytu — bieżący stan + co by się zmieniło
/setup-git-lite install    # Wyłącz CC native + włącz nasz minimalny hook
/setup-git-lite revert     # Przywróć domyślne (agresywne; patrz poniżej)
/setup-git-lite dismiss-banner    # Wycisz okazjonalną wskazówkę z zaleceniem
/setup-git-lite undismiss-banner  # Ponownie włącz wskazówkę
/setup-git-lite help       # Pełne użycie
```

### Semantyka instalacji

`install` modyfikuje **dwa** miejsca dla niezawodności:

1. `~/.claude/settings.json` — dodaje `"includeGitInstructions": false`
2. Profil shell (`~/.zshrc`, `~/.bashrc`, itp.) — dodaje blok znacznika eksportujący `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Jedno z nich samo w sobie wystarczy, aby wyłączyć CC native; ustawiamy oba, żeby nadpisanie środowiskowe nie przypadkowo ponownie włączyło natywnego zachowania. Zmiana shell obowiązuje tylko w nowych shellach.

### Semantyka cofania — agresywna

`revert` **usuwa WSZYSTKIE eksporty `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` z profilu shell**, w tym te, które mogłeś dodać ręcznie przed zainstalowaniem tego skill. Jest to zamierzone — uruchomiłeś `revert`, więc przywracamy czysty domyślny. Zawsze najpierw tworzymy kopię zapasową profilu shell ze znacznikiem czasu.

Jeśli potrzebujesz zmiennej środowiskowej z niezwiązanych powodów, zanotuj ją przed uruchomieniem `revert` i dodaj ponownie po.

### Przed odinstalowaniem super-token-saver

**Najpierw uruchom `/setup-git-lite revert`**, inaczej zostaniesz z `includeGitInstructions: false` w settings.json, ale bez zastępczego hooka (Claude nie otrzymuje żadnego wskazówek dotyczących git). Claude Code nie ma obecnie hooka cyklu życia odinstalowania wtyczki, więc nie możemy tego zautomatyzować.

### Kompromisy

Co tracisz (i dlaczego zazwyczaj to nic nie szkodzi):
- Claude nie otrzymuje już wstępnie obliczonego `git status` / `git log -n 5` na początku sesji. Jeśli zapytasz „co się zmieniło?" w nowej sesji, Claude sam uruchomi te polecenia (jedno dodatkowe wywołanie narzędzia, ~300 tok).
- Claude nie widzi już kanonicznej 3-krokowej procedury commitowania CC. W naszych testach przez setki przepływów commitowania, wiedza na poziomie treningu radzi sobie z krytycznymi przypadkami (formatowanie HEREDOC, bez `--amend`, bez force-push), ponieważ zachowujemy te jako jawne reguły.
- Szablon treści PR (`## Summary` + `## Test plan`) nie jest wstrzykiwany. Jeśli zależy Ci dokładnie na tym formacie, umieść go w CLAUDE.md swojego projektu.

### Baner z zaleceniem

Gdy natywne instrukcje git CC są nadal aktywne na Twoim komputerze, super-token-saver pokazuje jednoakapitową wskazówkę na początku sesji **~20% czasu** (plus w wyjściach `/usage-view` i `/report-limit`). Trwale wycisz za pomocą `/setup-git-lite dismiss-banner`.

---

## 🛡️ Funkcja 5: Token Guardian

**Informuje Cię w momencie, gdy wygasanie cache Cię kosztuje. Na żądanie może zablokować ponowną wysyłkę za $9.**

TTL cache promptów w Claude Code wynosi 1 godzinę. Odejdź na dłużej i cache wygaśnie. Twoja następna wiadomość ponownie wyśle cały kontekst po pełnej cenie. Przy 900K tokenach to $9 za jednym razem.

Token Guardian pamięta, kiedy nadeszła ostatnia odpowiedź. Jeśli minęło ponad 3590 sekund (TTL minus 10-sekundowy bufor), może interweniować. **Domyślnie jest wyłączony, ze względu na Remote Control.** Komunikat blokady hooka jest renderowany lokalnie jako komunikat systemowy, którego zdalny klient nigdy nie otrzymuje, więc zdalny użytkownik widział, jak prompt po prostu znikał bez żadnego wyjaśnienia. Zamiast wysyłać zabezpieczenie, które zachowuje się inaczej w zależności od tego, gdzie pracujesz, wyłączyliśmy je. Gdy Remote Control zacznie przekazywać komunikaty hooków, domyślne ustawienie wróci. Do tego czasu włącz je sam, wybierając jeden z dwóch trybów.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude wspomina o wygaśnięciu w pierwszej linijce
export CC_TOKEN_SAVER_CACHE_GUARD=block   # prompt jest odrzucany raz z poniższym komunikatem
```

W trybie `warn` prompt przechodzi, a Claude otwiera swoją odpowiedź jedną linijką informującą, że cache wygasł, że ta tura zapłaciła za cały kontekst, i że po przerwie godziny lub dłuższej tańszą drogą powrotną jest `/clear` → `/s-continue`. Ten dociera do zdalnego klienta, ponieważ odpowiedź Claude'a jest przekazywana dalej, mimo że komunikaty hooków — nie.

W trybie `block` prompt jest odrzucany raz z poniższym komunikatem. Wyślij go ponownie, a przejdzie. Używaj go w lokalnym terminalu, gdy chcesz twardego zatrzymania.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Komunikat blokady wyświetla się w 23 językach, wybieranych na podstawie ustawień regionalnych systemu operacyjnego, i pojawia się tylko raz na okres bezczynności.

**Agenty działające w tle nigdy nie są blokowane.** Sprawdzanie Token Guardian dotyczy tylko promptów wpisanych przez człowieka. Raporty ukończenia z agentów i zadań działających w tle — które teraz rutynowo docierają ponad godzinę po uruchomieniu — przechodzą bez przeszkód. Wynik długo działającego agenta nigdy nie zostaje wstrzymany ani utracony.

**Wynik:** w trybie ostrzegania zawsze wiesz, kiedy doszło do ponownej wysyłki za $9 i dlaczego. W trybie block to się w ogóle nie zdarza: każde przechwycone wygaśnięcie oszczędza $9, a przy jednym dziennie to $270/miesiąc wyeliminowanego czystego marnotrawstwa.

> **Jeśli korzystasz z API płatności za użycie, to uderza mocniej.** Subskrybent Max Plan traci $9 w ramach bufora $200. Ty tracisz $9 prawdziwych pieniędzy — po cichu, za każdym razem gdy odejdziesz. Tryb block zatrzymuje to za każdym razem.

---

## 💡 Jak naprawdę działa Cache (i dlaczego większość użytkowników marnuje na nim 40%+)

Claude Code wysyła całą historię rozmowy do modelu przy każdym wywołaniu API. „Wywołanie API" nie oznacza „jednej wiadomości, którą wpisałeś." Jeden prompt wyzwala wewnętrzne wywołania narzędzi — Grep, Read, Edit, Write — i każde z nich to osobne wywołanie API. Jeden prompt łatwo powoduje 10+ wywołań API.

Cache promptów zmniejsza ten koszt o 90%. Ale cache ma żywotność.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 godzina (ephemeral_1h)              | 5 minut                                |
| Zapis cache         | ＄10/MTok                              | ＄6.25/MTok                             |
| Odczyt cache        | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Gdy cache wygaśnie  | Pełny kontekst wysyłany ponownie po pełnej cenie | Niski wpływ (kontekst jest mały)   |

Nawet gdy cache jest aktywny, koszty kumulują się. Oto ekstremalny scenariusz pokazujący różnicę.

### Scenariusz: Pełny dzień kodowania (3h rano → 2h obiad/spotkanie → 3h po południu)

Warunki: Ceny Opus 4, 1 prompt na minutę, ~5 wywołań API na prompt (~300 wywołań/godzinę).

#### ❌ Bez super-token-saver

Większość pracy odbywa się w sesji Main. Kontekst szybko rośnie.

| Faza        | Sytuacja                          | Rozmiar kontekstu           | Koszt                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Rano 3h     | Kodowanie (głównie w Main)        | 100K → 600K (śr. 350K)     | 900 wywołań × 350K × ＄0.50/M = ＄157.50  |
| Obiad/spotkanie | Brak przez 2 godziny          | —                          | —                                      |
| Powrót      | Cache wygasł → pełne ponowne wysłanie | 600K pełna cena        | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Powrót      | /compact (podsumowanie)           | 600K → wysłane do LLM      | 600K × ＄0.50/M + wyjście podsumowania = ~＄1.50 |
| Po południu 3h | Kodowanie kontynuowane (kontekst rośnie ponownie) | 100K → 600K (śr. 350K) | 900 wywołań × 350K × ＄0.50/M = ＄157.50 |
|             | Łącznie                           |                            | ~＄326                                  |

> Przy tym poziomie użycia prawdopodobnie osiągniesz limit szybkości okna 5-godzinnego. **Koszt jest zły, ale prawdziwym problemem jest całkowite zatrzymanie Twojej pracy. To jest dokładny moment, kiedy Claude Code gaśnie.**

#### ✅ Z super-token-saver

Ciężka praca jest delegowana do SubTask. Main obsługuje tylko projektowanie/decyzje.

| Faza        | Sytuacja                                     | Rozmiar kontekstu               | Koszt                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Rano 3h     | Kodowanie (Main: projekt, SubTask: implementacja) | Main 100K → 300K (śr. 200K) | 900 wywołań × 200K × ＄0.50/M = ＄90 |
| Obiad/spotkanie | Brak przez 2 godziny                     | —                           | —                                  |
| Powrót      | ⚡ Token Guardian (tryb block) → /clear + /s-continue | —                        | ＄0 (brak wywołań LLM)              |
| Po południu 3h | Kodowanie kontynuowane                   | Main 100K → 300K (śr. 200K) | 900 wywołań × 200K × ＄0.50/M = ＄90 |
|             | Łącznie                                      |                             | ~＄180                              |

#### 💰 Wynik

> **＄326 → ＄180. ＄146 oszczędności dziennie. 45% redukcja kosztów.**
>
> **Max Plan:** Mniej tokenów = nie osiągasz limitu szybkości. Twoja praca nie zatrzymuje się. To jest prawdziwa różnica.
>
> **API płatność za użycie:** ＄146/dzień × 22 dni robocze = **＄3200/miesiąc prosto z faktury.** Ciężki miesiąc bez tej wtyczki przekracza ＄7000. Z nią poniżej ＄4000. Taki sam wynik.

### Gdzie wkracza super-token-saver

```
[Session Start]
    │
    ├─ Session Architect → Automatycznie wstrzykuje wzorzec delegowania SubTask
    │                       Utrzymuje kontekst Main poniżej 250K
    │
[Praca]
    │
    ├─ Status Line → Monitorowanie kosztów/kontekstu/limitu szybkości w czasie rzeczywistym
    │                  Natychmiastowy alert przy wejściu w strefę ostrzeżenia
    │
[Bezczynność 1+ godziny]
    │
    ├─ Token Guardian → Wykrywa wygasanie cache, ostrzega (lub blokuje w trybie block)
    │
[Restart sesji]
    │
    └─ /s-continue → Przywraca poprzedni kontekst bez żadnych kosztów (brak wywołań LLM)
```

---

## 🔧 Instalacja ze źródła i personalizacja

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver jest w pełni open-source (Apache-2.0). Czysty JavaScript + Bash — brak skompilowanych plików binarnych, brak zewnętrznych wywołań API, brak telemetrii. Każda linia jest audytowalna. Każde twierdzenie w tym README odpowiada konkretnemu plikowi, który możesz przeczytać.

- **hooks/** — Zmień próg wygasania cache, dostosuj komunikaty ostrzeżeń, modyfikuj reguły architektury sesji
- **scripts/** — Logika analizy, konstruktor raportów, formatowanie paska stanu
- **skills/** — Jak działają /s-continue i /usage-view, szablony promptów
- **locales/** — Dodawaj/edytuj tłumaczenia, dodawaj nowe języki
- **skills/usage-view/** — Zmiany projektu UI/UX panelu

Spraw, żeby był Twój. Forkuj, eksperymentuj i wyślij PR, jeśli znajdziesz coś lepszego.

---

## 🌐 Obsługiwane języki

23 języki obsługiwane. Wybrane przez skrzyżowanie 20 najlepszych krajów według użycia Claude Code z 20 najlepszymi językami według globalnej liczby mówiących. Język wyświetlania jest automatycznie wykrywany z ustawień regionalnych systemu operacyjnego. Możesz też podać ręcznie: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Obecne tłumaczenia są generowane przez AI. Mile widziane wkłady od native speakerów — edytuj plik JSON dla swojego języka w `locales/` i wyślij PR.

---

## ⚖️ Co ta wtyczka Cię kosztuje

Wtyczka wstrzykuje kontekst na początku sesji. Oto dokładnie ile:

| Wstrzyknięcie | Kiedy | Tokeny | Cel |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (jednorazowo) | ~1100 | Strategia delegowania SubTask + reguły concise mode |
| Kontekst git (jeśli git-lite włączone) | SessionStart (jednorazowo) | ~280 | Zastępuje natywne ~2200 tok instrukcje git CC |
| Ostrzeżenie o wygasaniu cache | Przy bezczynności > 59 min (jednorazowo) | ~200 | Sygnalizuje drogie ponowne wysłanie, pokazuje tańszą ścieżkę |
| Status line | Każde wywołanie API | 0 | Renderuje na pasek stanu terminala, nie do kontekstu rozmowy |

**Narzut netto na sesję: ~1400 tokenów (jednorazowo, buforowane po pierwszym wywołaniu).**

Przy cenach Opus ($0,50/MTok odczyt cache) to **$0,0007 na wywołanie API** — mniej niż jedna dziesiąta centa. W sesji 100 wywołań: $0,07.

Jeśli git-lite jest włączone, wtyczka **oszczędza** ~1920 tokenów na sesję (zastępuje 2200 przez 280). Efekt netto jest ujemny — wtyczka zużywa mniej niż usuwa.

**Dla użytkowników API płatności za użycie:** przy wydatkach $3000/miesiąc narzut wtyczki to poniżej $2/miesiąc. Oszczędności wyłącznie z zapobiegania wygasaniu cache (jedno zablokowane ponowne wysłanie $9 tygodniowo) pokrywają roczny narzut w jednym przechwyceniu.

---

## 💡 Wskazówki

### Zrozum cache i zobaczysz, gdzie trafiają pieniądze

- **1 prompt ≠ 1 wywołanie API.** Za każdym razem, gdy Claude wywołuje Grep, Read lub Edit, cały kontekst jest ponownie wysyłany. Jeden prompt łatwo wyzwala 10+ wywołań API. Pisz jasne prompty, żeby redukować zbędne wywołania narzędzi i obniżać koszty.
- **Timer cache resetuje się od ostatniego wywołania API, nie od ostatniego promptu.** Kontynuuj pracę i cache nigdy nie wygaśnie. Niebezpieczeństwem jest odejście. Token Guardian informuje Cię, kiedy to się stało, a w trybie `block` zatrzymuje prompt raz, więc możesz wybrać: zresetować kontekst albo kontynuować tak, jak jest.
- **Rozmiar kontekstu = mnożnik kosztów.** To samo wywołanie API przy 200K versus 800K kosztuje 4x więcej. Gdy pasek stanu [CTX] przekroczy 35% (🟡), to Twój sygnał, żeby delegować więcej do SubTask.

### Nawyki obniżające koszty

- **Trzymaj CLAUDE.md krótko.** Ładuje się do system prompt przy każdym wywołaniu API. Każda linia kosztuje.
- **Deleguj ciężką pracę do SubTask.** Generowanie kodu, edycje wielu plików, uruchamianie testów nie należą do Main. SubTask mają mniejszy kontekst i tańszą warstwę cache.
- **Odszedłeś na 1+ godzinę?** `/clear` → wróć → `/s-continue`. Kontekst przywrócony za $0.
- **[5H] powyżej 70% (🟡)?** Zwolnij. Przełącz się na lekkie zadania przeglądowe lub zwiększ delegowanie do SubTask, żeby zredukować liczbę wywołań API Main.
- **Używaj `/btw` do pobocznych pytań.** Nie wchodzi do historii rozmowy, więc kontekst pozostaje zwarty.

### API płatność za użycie: nawyki, które mają największe znaczenie

Wszystko powyżej obowiązuje, plus te priorytety specyficzne dla API:

- **Obserwuj [CTX] jak prędkościomierz.** Żaden limit szybkości Cię nie zatrzyma — ale kontekst przy 500K+ oznacza, że każde wywołanie API kosztuje 2-3x tyle, ile powinno. `/clear` → `/s-continue` jest darmowe i resetuje mnożnik kosztów do poziomu bazowego.
- **Uruchamiaj `/usage-view` co tydzień.** Użytkownicy Max Plan mają naturalny moment „autsch" gdy osiągają limit szybkości. Ty nie — koszty rosną po cichu. Panel to Twój system wczesnego ostrzegania.
- **Wyznacz sobie mentalny dzienny budżet.** Bez górnego limitu, dni za $200 zdarzają się niezauważone. Wskaźnik RUN paska stanu sprawia, że koszt na turę jest widoczny. Jeśli jedna tura przekroczy $1 (🔴), Twój kontekst jest zbyt duży.

---

## 📚 Dokumentacja

- [Przewodnik po cache promptów](guides/prompt-cache-guide.md) — Dlaczego większość Twojego kosztu to cache, jak działa buforowanie u dostawców (Anthropic, OpenAI, Gemini) i jak nim zarządzać ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Analiza kosztów Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Co najmniej o 24–38% taniej niż Opus 5 przy tej samej jakości, dla 2782 sesji
- [Analiza kosztów Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Analiza kosztów Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — Porównanie kosztów dla 8563 wywołań API
- [Analiza kosztów Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Licencja

Apache-2.0
