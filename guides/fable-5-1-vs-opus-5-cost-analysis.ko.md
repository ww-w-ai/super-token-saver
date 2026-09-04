# Fable 5.1이 Opus 5보다 최소 24~38% 싸다

**조사 기간**: 2026-08-03 ~ 2026-09-02 (31일)
**환경**: Claude Code, macOS, Max 20x 플랜, 한국어/영어 혼용 대화
**표본 규모**: 2,782개 세션(메인 1,331개 + 서브에이전트 1,451개), 148.6억 토큰, 청구액 $7,646
**방법**: `/usage-view`(super-token-saver v3.3.0), 서브에이전트 재생 데이터 중복 제거 적용
**가격 기준**: Anthropic이 공개한 API 정가. 구독 플랜(Max 5시간·주간 창)의 차감은 이와 다릅니다. 부록 A 참조.

> English: [fable-5-1-vs-opus-5-cost-analysis.md](./fable-5-1-vs-opus-5-cost-analysis.md)

---

## 0. 핵심 요약

### 같은 품질이면 24~38% 쌉니다. 세션이 길수록 더 벌어집니다.

Fable 5.1은 Anthropic이 **두 모델을 함께 실은 모든 벤치마크**에서 Opus 5보다 점수가 높습니다(§1). 그래서 비용을
비교하면서 품질을 양보할 필요가 없습니다.

모델이 더 좋으니 같은 점수를 **더 낮은 effort 설정**에서 냅니다. effort가 낮으면 턴마다 생각하는
양이 줄고, 그만큼 토큰도 덜 씁니다.

같은 점수를 기준으로 놓으면 Anthropic의 CursorBench effort 곡선에서 Fable 5.1이 Opus 5보다
**24~38% 쌉니다**(차트에서 읽은 값, 비용 ±5%). 이 값은 각 모델의 가격표로 계산한 작업당 달러 금액이라, Fable 5.1의 비싼 입력·출력
단가가 이미 들어가 있는 최종 숫자입니다.

그런데 이 벤치마크는 태스크 하나를 짧게 돌린 결과입니다. 장시간 자율 실행에서는 캐시 읽기가
**청구액에서 가장 큰 항목**이 되고, Fable 5.1의 캐시 읽기 단가는 Opus 5의 절반입니다. 실제 31일 사용량의
토큰 구성으로 계산하면 Fable 5에서 Fable 5.1로 넘어갈 때 44.5%가 줄어드는데, 이는 Anthropic이 "매우
에이전틱한 작업에서 최대 약 45%"라고 밝힌 수치와 맞습니다.

그러니 24~38%는 짧은 태스크가 정한 바닥값입니다. 세션이 길수록 청구액에서 캐시 읽기 비중이 커지고,
Fable 5.1은 그만큼 더 앞서갑니다(§3). 이 리포트의 청구 수치는 전부 super-token-saver의
`/usage-view`에서 나왔습니다(§4).

---

## 1. 모델이 더 좋아서 effort가 덜 듭니다

Anthropic이 공개한 벤치마크 표에서는 **실린 모든 항목**에서 Fable 5.1이 Opus 5를 앞섭니다.

| 벤치마크 | Fable 5.1 | Opus 5 |
|---|---|---|
| Terminal-Bench-Science 0.1 | **52.6%** | 29.0% |
| Terminal-Bench 4.0 | **55.8%** | 52.3% |
| GDPval-AA v2 | **1853** | 1824 |
| OSWorld 2.0 (strict) | **41.7%** | 39.6% |
| Humanity's Last Exam (도구 없음) | **60.9%** | 56.6% |
| Humanity's Last Exam (도구 사용) | **65.0%** | 63.6% |
| AutomationBench | **31.4%** | 26.9% |
| CursorBench 3.2.0 | **73.4%** | 70.0% |

*Terminal-Bench-Science 0.1은 모델당 표준오차 ±3.5~4.5pt입니다. 출처: [anthropic.com/claude-fable-and-mythos-5-1](https://www.anthropic.com/claude-fable-and-mythos-5-1)*

점수가 높다는 것과 비용이 낮다는 것은 다른 이야기입니다. 장시간 실행에서 비용을 가르는 것은 effort 설정이고,
Anthropic은 이 축에 대해 이렇게 밝혔습니다(Claude Code는 Fable 5.1을 High로 기본 설정합니다).

> "when set to Low or Medium effort, Fable 5.1 achieves results similar to or better than Fable 5's
> at a much lower cost. (Note that Fable 5.1 defaults to High effort in Claude Code, and to Medium
> in Claude Cowork and on Claude.ai.)"
>
> (Low 또는 Medium effort에서 Fable 5.1은 훨씬 낮은 비용으로 Fable 5와 비슷하거나 더 나은 결과를
> 냅니다. Fable 5.1은 Claude Code에서 High, Claude Cowork과 Claude.ai에서 Medium이 기본값입니다.)

하지만 이 effort 비교의 상대는 **Opus 5가 아니라 Fable 5**입니다. Anthropic이 이 문서에서 effort 수준별(low /
med / high / xhigh / max) 정확도 대 비용 곡선을 공개한 것은 Fable 5.1 대 Fable 5(그리고 Mythos)뿐이고, effort 수준별로
Fable 5.1과 Opus 5를 직접 비교한 수치는 공개하지 않았습니다. 그래서 우리는 다른 문서 하나를 더 찾아서
비교해야 했습니다.

### Opus 5가 출시 당시 내세운 논리

Opus 5 발표문([2026-07-24](https://www.anthropic.com/news/claude-opus-5))은 이 모델을 Fable 5 대비
가격 경쟁력으로 소개했습니다.

> "It's a thoughtful and proactive model that comes close to the frontier intelligence of Claude
> Fable 5 **at half the price**."
>
> (Claude Fable 5의 프런티어 지능에 근접하면서 **가격은 절반**입니다.)

> "On CursorBench 3.2, at max effort, the model performs within 0.5% of Fable 5's peak score, but
> **at half the cost per task**; it also achieves greater performance at a given cost than all other
> models on **high, xhigh, and max effort**."
>
> (CursorBench 3.2에서 max effort일 때 Fable 5 최고점과 0.5% 이내로 붙으면서 **작업당 비용은
> 절반**입니다. high·xhigh·max effort에서는 같은 비용 대비 다른 모든 모델보다 성능이 높습니다.)

두 발표문의 CursorBench 수치는 서로 정확히 맞물립니다.

| CursorBench 3.2 | 점수 |
|---|---|
| Fable 5 (최고점) | 70.5% |
| Opus 5 | 70.0% — *"Fable 5 최고점과 0.5% 이내"* |
| **Fable 5.1** | **73.4%** |

정리하면 Opus 5가 내세운 것은 **Fable에 가까운 품질을 절반 값에**였습니다. 지금은 두 축이 다
움직였습니다. Fable 5.1은 더 이상 근접 수준이 아니라 공개된 모든 벤치마크에서 앞서고, "절반 값"의
기준이던 Fable 5의 캐시 읽기 단가는 100만 토큰당 $1.00에서 $0.25가 됐습니다.

Anthropic은 새 캐시 읽기 가격으로 이 effort별 정확도 대 비용 곡선을 다시 내지 않았습니다. 이 리포트는
그 재가격이 실제 작업에서 어떻게 작용하는지 잰 결과입니다(§3).

### Fable 5.1과 Opus 5를 한 축에서 비교하기

어느 발표문에도 Fable 5.1과 Opus 5를 직접 비교한 그래프는 없습니다. 다만 두 발표문 모두 같은 축에서
**Fable 5**의 **CursorBench 3.2.0** 결과를 보여줍니다. 축은 점수와 작업당 비용(USD, 로그 스케일)이고
effort 단계는 low→max입니다. 두 차트의 Fable 5 곡선이 같으므로 이를 연결 기준으로 쓸 수 있습니다.

두 차트를 겹친 결과입니다. 수치는 공개 차트에서 읽었고 오차 범위는 점수 ±0.2pt, 비용 ±5%입니다.

| Effort | Opus 5 | Fable 5.1 | Fable 5 *(연결 기준)* |
|---|---|---|---|
| low | $2.45 / 62.8 | $2.9 / **66.2** | $4.5 / 62.1 |
| med | $3.2 / 64.2 | $3.5 / **68.1** | $6.9 / 65.1 |
| high | $4.0 / 66.7 | $4.8 / **69.4** | $8.7 / 66.5 |
| **xhigh** | $7.3 / 69.3 | **$7.2 / 72.7** | $11.8 / 68.4 |
| max | $8.5 / 70.0 | $9.5 / **73.4** | $17.5 / 70.5 |

모든 effort 단계에서 Fable 5.1이 Opus 5보다 점수가 높습니다. 비용 차이도 작아서, 같은 effort가 아니라
같은 점수로 비교하면 순서가 뒤집힙니다.

- **xhigh에서는 비용이 거의 같고 점수만 다릅니다.** $7.2와 $7.3은 차트 판독 오차 안이고, 점수는 **+3.4pt**
  차이입니다.
  이 단계에서는 가격을 이유로 Opus 5를 고르기 어렵습니다.
- **Fable 5.1 low의 66.2점은 Opus 5 high의 66.7점과 0.5pt 차이입니다. 비용은 약 27% 낮습니다.**
- **Opus 5의 최고점은 max에서 70.0점($8.5)입니다.** Fable 5.1은 high와 xhigh 사이, 약 $5.2에서 이 점수를
  넘습니다. **Opus 5 최고 성능보다 약 38% 쌉니다.**
- **73.4점은 Opus 5가 어떤 effort 설정으로도 내지 못합니다.**

Fable 5에서 Fable 5.1로 곡선이 얼마나 움직였는지도 보십시오. low는 $4.5 → $2.9(−36%), max는 $17.5 →
$9.5(−46%)입니다. 이 이동에는 두 가지가 섞여 있습니다. 차트에 이미 반영된 새 캐시 읽기 가격, 그리고 다른
모델이 다른 양의 일을 한 효과입니다. Anthropic의 "최대 약 45%"는 그중 가격 변경만 잰 값이고, §3이 그
부분을 청구 데이터로 재현합니다.

#### 같은 점수를 기준으로 계산한 비용

품질 목표를 정해 놓고 각 모델이 그 점수를 내는 데 얼마를 받는지 비교한 것입니다. Fable 5.1의 비용은
공개된 effort 지점 사이를 선형 보간한 값입니다. (기하 보간으로 바꾸면 0.3~1.5% 차이가 나는데, 차트 판독
오차 ±5%보다 작습니다.)

| 목표 점수 | Opus 5 | Fable 5.1 | 절감 |
|---|---|---|---|
| 66.7 | $4.00 (high) | ~$3.06 | **−24%** |
| 69.3 | $7.30 (xhigh) | ~$4.70 | **−36%** |
| 70.0 *(Opus 5 최고점)* | $8.50 (max) | ~$5.24 | **−38%** |
| 70.0 초과 | 도달 불가 | $5.24 → $9.50 | — |

**품질 기준을 높일수록 격차가 벌어지고**, 70.0 위로는 비교 자체가 없어집니다.

이 달러 수치는 Anthropic이 각 모델의 가격표로 계산한 작업당 비용입니다. Fable 5.1의 2배 입력·출력
단가와 $0.25 캐시 읽기가 이미 안에 들어 있습니다. 여기에 가격 차이를 다시 얹을 필요가 없습니다.

**이 연결은 벤치마크 하나에서만 성립합니다.** CursorBench 3.2.0은 양쪽 페이지에 Fable 5가 완전한 effort
단계로 실린 유일한 차트입니다. Fable 5.1 페이지의 Terminal-Bench 4.0은 Mythos 5.1 / Fable 5.1 / Mythos 5를
그려서 Opus 5 페이지와 공통 모델이 없고, 그래서 이을 수 없습니다. Frontier-Bench v0.1은 Opus 5 페이지에만
있는데, 거기서는 **Opus 5가 모든 effort 단계에서 Fable 5를 크게 이겼습니다**(시도당 비용은 더 낮으면서
약 10pt 높음). Fable 5.1은 이 벤치마크로 공개된 적이 없어서 그 격차는 여기서 다시 평가할 수 없습니다.

얼리액세스 파트너 한 곳이 이 리포트의 결론을 그대로 말합니다.

> "We're moving our Opus 5 traffic in Devin to Claude Fable 5.1 on launch day. It matched or edged
> out Fable 5 in our testing at a lower cost per task, and with the new cache read pricing a
> Fable-class model is finally economical for the workloads we'd kept on Opus, starting with code
> review."
> — Walden Yan, Co-founder and CPO, Cognition
>
> (출시일에 Devin의 Opus 5 트래픽을 Fable 5.1로 옮깁니다. 테스트에서 작업당 비용은 더 낮으면서
> Fable 5와 같거나 조금 앞섰고, 새 캐시 읽기 가격 덕분에 Fable급 모델이 우리가 Opus에 남겨 뒀던 작업에
> 드디어 수지가 맞습니다. 코드 리뷰부터 시작합니다.)

**Anthropic이 공개하지 않은 것이 Opus 5와의 가격 비교입니다.** 발표문의 절감폭, 즉 "전형적인 워크로드에서
Fable 5보다 약 25% 저렴"과 매우 에이전틱한 작업의 "최대 약 45%"는 전부 Fable 5.1 **대 Fable 5**입니다.
이 리포트는 다른 축을 잽니다. 실제 31일치 청구서로 잰 Fable 5.1 대 Opus 5입니다.

---

## 2. 더 빠르고 읽기 쉽습니다

effort를 낮추면 그 자체로 빨라집니다. 턴마다 생각하는 양이 줄기 때문입니다. 토큰을 줄이는 effort 조정이
실행 시간도 같이 줄입니다.

얼리액세스 파트너들은 같은 effort에서도 Fable 5.1이 Opus 5보다 빠르고 토큰을 덜 쓰며, 긴 작업에서도
출력이 읽기 쉽다고 보고했습니다.

> "It's friendly Fable. Fable-level intelligence, Opus-level price, Sonnet-speed. In our tests it was about twice as fast as Opus 5 and used half as many tokens, so for anyone used to using Opus as their daily driver it's an obvious upgrade."
> — Every / Dan Shipper, CEO
>
> (친근한 Fable입니다. Fable급 지능, Opus급 가격, Sonnet급 속도. 우리 테스트에서는 Opus 5보다 약 2배
> 빠르고 토큰은 절반을 썼습니다. Opus를 매일 쓰던 사람이라면 당연한 업그레이드입니다.)

> "On our hardest browser-agent benchmark, Claude Fable 5.1 completed 82% of tasks in about 10 minutes each, against 74% for Opus 5 and 57% for Fable 5, while using fewer tokens than either."
> — Browserbase / Miguel Gonzalez, Technical Lead
>
> (가장 어려운 브라우저 에이전트 벤치마크에서 Claude Fable 5.1은 태스크당 약 10분에 82%를 완료했습니다.
> Opus 5는 74%, Fable 5는 57%였고, 토큰은 둘보다 적게 썼습니다.)

> "While prior models became hard to follow the longer they worked, Fable 5.1 remains readable over long, multi-step tasks."
> — Jane Street Capital / Craig Falls, Head of Quantitative Research
>
> (이전 모델은 오래 일할수록 따라가기 어려워졌는데, Fable 5.1은 길고 여러 단계로 된 작업에서도 읽을 만합니다.)

이 셋은 파트너가 보고한 관찰이지 이 리포트가 직접 잰 값이 아닙니다. 출처는 모두
[Anthropic 고객 인용](https://www.anthropic.com/claude-fable-and-mythos-5-1)입니다.

---

## 3. 세션이 길수록 격차가 벌어집니다: 캐시 읽기

위 벤치마크는 태스크 하나를 짧게 돌린 것이라 캐시 읽기 비중이 작습니다. 실제 에이전트 작업은 긴
세션이고, 거기서는 캐시 읽기가 가장 큰 항목이 됩니다.

### 돈이 실제로 어디로 가나

31일 전체 사용량을 Opus 5 단가로 다시 계산한 것입니다.

| 토큰 종류 | 토큰 | 비용 | 비중 |
|---|---|---|---|
| **캐시 읽기** | 142.8억 | **$7,140** | **59.4%** |
| 캐시 쓰기 (5분) | 4.03억 | $2,519 | 21.0% |
| 캐시 쓰기 (1시간) | 1.32억 | $1,320 | 11.0% |
| 출력 | 4,140만 | $1,035 | 8.6% |
| 입력 | 27.4만 | $1.37 | 0.0% |
| **합계** | 148.6억 | **$12,015** | 100% |

캐시 읽기가 전체 토큰의 96.1%, 전체 비용의 59.4%입니다. 새로 넣는 입력은 **0.0%**입니다.

코딩 에이전트의 비용 구조가 원래 이렇습니다. 매 턴 대화 전체를 다시 보내고, 캐시가 그 비용이 걷잡을 수
없이 커지는 것을 막습니다. 실행이 길고 자율적일수록 청구액은 이 한 항목으로 쏠립니다.

그리고 그 한 항목이 Fable 5.1이 유일하게 싸게 만드는 항목입니다.

### 항목별 배수

| 토큰 종류 | Opus 5 | Fable 5.1 | 배수 |
|---|---|---|---|
| 입력 | $5.00 | $10.00 | 2.0× |
| 출력 | $25.00 | $50.00 | 2.0× |
| 캐시 쓰기 (5분) | $6.25 | $12.50 | 2.0× |
| 캐시 쓰기 (1시간) | $10.00 | $20.00 | 2.0× |
| **캐시 읽기** | **$0.50** | **$0.25** | **0.5×** |

*100만 토큰당 USD. 출처: [platform.claude.com/docs/ko/about-claude/pricing](https://platform.claude.com/docs/ko/about-claude/pricing)*

가격표상 Fable 5.1은 Opus 5의 2배입니다. 입력, 출력, 캐시 쓰기가 전부 정확히 2배입니다. Mythos 5.1을 뺀 다른
모델은 모두 캐시 읽기를 입력 단가의 0.1배로 매기는데, Fable 5.1과 Mythos 5.1은 0.025배입니다.

Fable 5는 캐시 읽기($1.00)까지 포함해 모든 항목이 정확히 Opus 5의 2배였습니다. Fable 5.1은 그중 캐시
읽기만 $0.25로 바꿨습니다. 따라서 이렇게 됩니다.

```
Fable 5.1 비용 = (1 − 0.75 × 캐시 읽기 비중) × Fable 5 비용
```

실측 비중 59.4%를 넣으면 0.555, 즉 44.5% 절감입니다. Anthropic이 매우 에이전틱한 작업에 대해 "최대 약
45%"라고 한 그 숫자를, 독립적인 청구 데이터에서 다시 얻은 것입니다.

> "Fable 5.1 will cost an estimated 25% less than Fable 5 for typical workloads, wherever usage is
> billed by token. This is because we're reducing our pricing on cache reads (where the model reads
> inputs that have already been processed and stored). For highly agentic work, the savings will
> often be much larger—up to approximately 45%."
>
> (토큰 단위로 과금되는 곳이라면 Fable 5.1은 전형적인 워크로드에서 Fable 5보다 약 25% 저렴할 것으로
> 추정합니다. 캐시 읽기, 즉 이미 처리되어 저장된 입력을 모델이 읽는 부분의 가격을 내렸기 때문입니다.
> 매우 에이전틱한 작업에서는 절감폭이 훨씬 커서 최대 약 45%에 이르는 경우가 많을 것입니다.)

방향은 확실합니다. 세션이 길어지면 캐시 읽기 비중이 올라가고, 그러면 Fable 5.1이 상대적으로 더 싸집니다.
벤치마크 수치를 넘어서는 크기까지는 여기서 재지 않았습니다.

---

## 4. 어떻게 쟀나: super-token-saver `/usage-view`

이 리포트의 청구 수치는 전부 명령 하나에서 나왔습니다. `/usage-view`는 Claude Code가 남긴
트랜스크립트(Codex 세션 포함)를 직접 읽어, 요청마다 토큰 종류별로 공개 가격표를 적용하고, 자체 완결형
HTML 대시보드로 그립니다. 모델별·토큰 종류별 비용, 5시간 사용량 창, 서브에이전트까지 내려가는 세션
상세가 한 화면에 나옵니다.

![super-token-saver usage-view 대시보드](../docs/images/usage-view-fable-report.png)

이 리포트가 걸려 있는 숫자인 캐시 읽기 비중은 토큰 분해 표에서 바로 읽힙니다.

**서브에이전트 재생 중복 제거.** Claude Code의 `runForkedAgent`는 부모 세션의 히스토리를 서브에이전트
사이드체인에 다시 넣는데, 이 재생 행은 원래 `requestId`를 그대로 갖고 있습니다. 그냥 더하면 두 번
세어지고, 재생분이 거의 전부 캐시 읽기라 이 분석의 핵심 항목이 그만큼 부풀려집니다. `/usage-view`는
부모 타임라인에 이미 있는 `requestId`를 가진 서브에이전트 행을 버립니다.

| | 캐시 읽기 비중 | Fable 5 → 5.1 절감 환산 |
|---|---|---|
| 중복 제거 전 | 65.7% | 49.3% (Anthropic이 밝힌 상한을 넘음) |
| 중복 제거 후 | 59.4% | 44.5% ("최대 약 45%"와 일치) |

보정한 값은 Anthropic 숫자에 정확히 닿고, 보정하지 않은 값은 그 위로 넘어갑니다.

실행은 Claude Code에서 `/usage-view` 한 줄입니다. 세션별로 캐시되어 다시 돌려도 비용이 없고,
`/usage-view private`를 쓰면 프롬프트 본문을 빼고 만들어 공유해도 됩니다.

**범위.** 계정 하나, 31일, 워크로드 성격 하나(긴 세션 위주의 자율 멀티에이전트 스프린트)입니다. 캐시
읽기 비중은 사람마다 다르지만, 효과의 방향은 같습니다.

---

## 5. 그래서 무엇을 하면 되나

1. **Fable 5.1을 2배로 계산하지 마십시오.** Anthropic 자체 차트에서 같은 품질 기준으로 24~38% 쌉니다.
2. **Opus 5를 쓰던 설정에서 effort를 한두 단계 낮추십시오.** 절감은 거기서 나옵니다.
3. **세션이 길다면 벤치마크 수치보다 더 좋을 것으로 보고, `/usage-view`로 자기 캐시 읽기 비중을
   재십시오.** 비중이 높을수록 격차가 벌어집니다.

가격표는 2배라고 합니다. Anthropic 자체 차트는 같은 품질에서 24~38% 싸다고 하고, 실제 세션은 그 위로
밀어 올립니다.

위의 달러 수치는 전부 API 정가입니다. Max 플랜이라면 실제로 쓰는 것은 5시간 창과 주간 창의 퍼센트이고,
그 창은 정가로 차감되지 않습니다. 부록 A에 잰 것을 적었습니다.

---

## 부록 A. 구독 창의 차감: 실험 하나가 보여준 것 (2026-09-04)

Max 플랜은 달러를 청구하지 않고 5시간 창과 주간 창을 소모합니다. 토큰이 창 퍼센트로 어떻게 바뀌는지
Anthropic은 공개하지 않아서, 토큰 종류 하나를 직접 쟀습니다.

**방법.** 컨텍스트 약 430K 토큰인 Claude Code 세션 하나를 서브에이전트로 포크해, 아무것도 안 하는 셸
명령을 1,000번 연속 호출했습니다. 호출마다 컨텍스트 전체가 프롬프트 캐시 읽기로 다시 나가고 출력은 몇
토큰뿐입니다. 캐시 쓰기와 출력이 거의 0이라 창의 변화는 캐시 읽기 몫입니다. 5시간 사용률은 Anthropic의
OAuth 사용량 엔드포인트에서 50회마다 읽었습니다. 그동안 그 계정에서 다른 세션은 돌리지 않았습니다. 두
모델에 같은 절차를 썼습니다.

| | Opus 5 | Fable 5.1 |
|---|---|---|
| 요청 | 995 | 1,001 |
| 캐시 읽기 토큰 | 441M | 435M |
| 캐시 쓰기 토큰 | 0.5M | 0.7M |
| 출력 토큰 | 9.6K | 10.9K |
| 5시간 창 변화 | +7pt | +7~8pt |

**결과.** 캐시 읽기 토큰 하나당 5시간 창 소모는 두 모델이 같았습니다. 100만 토큰당 약 0.011~0.013
포인트입니다(사용률이 정수로만 나와 범위로 적습니다). 어느 모델이든 정가 비례로 계산한 값보다 훨씬
낮습니다.

**이 리포트에 주는 뜻.** 24~38%와 3절의 캐시 읽기 배수는 정가 기준이고, 정가에서는 Fable 5.1의 캐시
읽기가 Opus 5의 절반입니다. 그런데 구독 플랜의 리미터는 캐시 읽기를 정가 달러가 아니라 토큰 수로
차감하는 것으로 보입니다. "창도 가격에 비례해 차감되겠지"라고 짐작하는 사람이라면, Fable 5.1이 정가가
암시하는 것보다 최대 2배쯤 빨리 창을 소모할 수 있다는 결론에 이를 것입니다. 이것은 검증한 결과가
아니라 이 측정이 열어 둔 가능성입니다. Fable 5.1의 캐시 쓰기와 출력은 재지 않았고, 둘 다 창에서
캐시 읽기보다 무겁습니다.

**한계.** 계정 하나, 하루, 정수 해상도, 토큰 종류 하나. 두 실행 모두 같은 비선형 계단(250회에서 3
포인트, 이후 약 250회마다 1포인트)을 보여 리미터가 단순한 요청별 합산은 아닙니다. 이유는 아직
모릅니다.

---

*super-token-saver `/usage-view`로 생성: [github.com/ww-w-ai/cc-token-saver](https://github.com/ww-w-ai/cc-token-saver)*
