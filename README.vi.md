# super-token-saver

**Plugin Claude Code duy nhất thực sự đọc mã nguồn của CC để tìm ra nơi token của bạn đang đi — và tự động khắc phục. Chi ít hơn, code lâu hơn.**

> Kết quả đo thực tế: **giảm 45% chi phí** trên khối lượng công việc thực $326/ngày → $180/ngày. Tự động ủy thác SubTask, khôi phục ngữ cảnh không tốn chi phí, bảng phân tích đầy đủ, và bảo vệ khỏi cache hết hạn — chỉ cần một lần cài đặt, không cần cấu hình.

Hoạt động với **Max Plan ($200/tháng)** và **API trả theo lượng dùng**. Cùng plugin, cùng tính năng. Mạnh mẽ hơn cho mọi người dùng — đặc biệt khi mỗi token đều là tiền thật.

![Bảng điều khiển sử dụng — xem chính xác token của bạn đi đâu](docs/images/usage-view-overview.png)

### Nó làm gì trong 30 giây

| Tính năng | Điều xảy ra | Tác động |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Tự động ủy thác công việc nặng cho SubTask (cache rẻ hơn 37,5%) | Ngữ cảnh nhỏ gọn, chi phí giảm |
| 🪶 Concise Mode | Cắt bỏ phần đệm trong phản hồi, giữ lại nội dung cốt lõi | Ít output token hơn cho mỗi phản hồi |
| 🔄 /s-continue | Thay thế /compact — không LLM call, không chi phí, không mất thông tin, và giờ khôi phục được cả phiên **Codex** | Khôi phục ngữ cảnh miễn phí trên cả hai công cụ |
| 🤝 /s-compact | Ghi lại bàn giao phiên mà /s-continue tự động tải — nắm bắt phát hiện của subagent & kết quả công cụ mà transcript bị mất | Phiên tiếp theo khôi phục cả ngữ cảnh ẩn |
| 📊 Status Line | Chi phí thời gian thực, kích thước ngữ cảnh, giới hạn tốc độ — dưới 50ms | Thấy vấn đề trước khi chúng tốn tiền |
| 📈 /usage-view | Bảng điều khiển HTML tương tác với phân tích AI | Điều tra chi phí toàn diện chỉ một cú nhấp |
| ✂️ /setup-git-lite | Loại bỏ 2.200 token ẩn CC đưa vào mỗi phiên | ~$48/tháng tiết kiệm chỉ từ hướng dẫn git |
| 🛡️ Token Guardian | Báo cho bạn ngay khoảnh khắc cache hết hạn gửi lại ngữ cảnh, hoặc chặn nó ở chế độ `block` | Không còn bất ngờ $9 âm thầm |

---

## 😤 Vấn đề

**Chi phí vô hình.** Không có khả năng xem theo thời gian thực. Không có cảnh báo "ngữ cảnh của bạn đang ở 800K". Không có thông báo "cache đã hết hạn 3 phút trước". Bạn chỉ biết sau khi thiệt hại đã xảy ra.

**Ngữ cảnh phình to.** Cùng một prompt với ngữ cảnh 200K so với 800K tốn kém gấp 4 lần. Mỗi Read, Grep, Edit đều gửi lại toàn bộ ngữ cảnh. Một prompt phức tạp kích hoạt 15+ API call, mỗi cái được nhân với kích thước ngữ cảnh của bạn.

**Cache hết hạn.** Bạn đi ăn trưa về. Cache đã biến mất. Một prompt gửi lại 900K token với giá đầy đủ. $9 trong một lần duy nhất.

**Tất cả đều thủ công.** Quản lý ngữ cảnh, thời điểm cache hết hạn, ủy thác SubTask, dọn dẹp phiên. Không ai có thể theo dõi tất cả điều này trong khi thực sự đang code.

**Max Plan ($200/tháng)?** Tất cả những điều trên, cộng thêm giới hạn tốc độ 5 giờ làm gián đoạn công việc của bạn mà không có bộ đếm thời gian hay ước tính.

**API trả theo lượng dùng?** Tất cả những điều trên, ngoại trừ không có trần giới hạn. Một lần bỏ lỡ cache = $9 tiền thật. Mười lần một tuần = $360/tháng chỉ vì tai nạn. Một ngày thứ Ba tệ với ngữ cảnh phình to có thể tốn nhiều hơn những gì người dùng Max Plan trả trong một tháng.

super-token-saver xử lý tất cả tự động. **Cài một lần. Xong.**

---

## 🚀 Cài đặt

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

Hoạt động tự động sau khi cài đặt. Không cần cấu hình. Yêu cầu [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Để theo dõi trực tiếp:

```
/setup-statusline install
```

Để cắt bỏ 2.200 token ẩn từ hướng dẫn git tích hợp của CC ([chi tiết](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Tính năng 1: Smart Session Architecture

**Cài đặt xong và các mẫu làm việc tối ưu chi phí được kích hoạt tự động.**

Hầu hết người dùng làm tất cả trong Main session. Đọc file, tạo code, chạy test. Mỗi output chồng chất vào ngữ cảnh và được gửi lại với mỗi tin nhắn. Phiên phình to. Chi phí tích lũy theo quả cầu tuyết.

Session Architect tự động đưa vào chiến lược ủy thác khi bắt đầu phiên.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Vai trò          | Thiết kế, quyết định, đánh giá   | Thực thi, tạo code, đa file           |
| Cache tier       | 1 giờ (ephemeral_1h)              | 5 phút                                |
| Chi phí ghi cache | ＄10/MTok                         | ＄6.25/MTok                            |
| Kích thước ngữ cảnh | ~94K trung bình                | ~33K trung bình                        |

SubTask có **chi phí ghi cache rẻ hơn 37,5%** so với Main. Ngữ cảnh cũng nhỏ hơn nhiều. Ủy thác công việc nặng cho SubTask cắt giảm chi phí đáng kể.

**Kết quả:** Ngữ cảnh dưới 250K thay vì tăng lên 600K+. Cùng đầu ra công việc, chi phí token giảm một nửa. Hoàn toàn tự động.

---

## 🪶 Concise Mode

**Cùng nội dung. Ít phần đệm hơn. Bật theo mặc định.**

Hook SessionStart cũng đưa vào quy tắc về phong cách phản hồi chạy trong **mọi phiên và mọi model** — không cần cờ, không cần thiết lập. Ba điều thay đổi:

- **Loại bỏ phần mở đầu** — không có "Hãy để tôi kiểm tra…", "Bây giờ tôi sẽ…", lặp lại câu hỏi của bạn, hoặc tóm tắt những gì diff đã hiển thị
- **Định dạng phù hợp với nội dung** — gạch đầu dòng cho danh sách, văn xuôi cho lý luận (đánh đổi, nhân quả, cơ sở). Không cái nào bị ép buộc
- **Diễn đạt súc tích hơn** — cùng quan điểm, ít từ hơn. Văn xuôi rõ ràng hơn là văn xuôi ngắn hơn

Giới hạn cứng: không bao giờ bỏ nội dung, bỏ qua xác minh, hay thu gọn sắc thái thành một câu duy nhất. Nội dung cốt lõi được giữ nguyên; chỉ phần bọc ngoài co lại.

Cài một lần, áp dụng ở khắp nơi.

---

## 🔄 Tính năng 2: /s-continue — Khôi phục ngữ cảnh

**Thay thế `/compact`. Không LLM call. Không tốn token. Không mất thông tin.**

`/compact` gửi toàn bộ ngữ cảnh của bạn (~1M token) đến LLM để nén thành bản tóm tắt 3,3%. Nếu cache đã hết hạn, điều đó một mình kích hoạt full re-cache. Mất thông tin là không thể tránh khỏi.

`/s-continue` tiếp cận hoàn toàn khác. Nó xử lý trước bản ghi phiên trước đó và tải trực tiếp. Không LLM call. Không chi phí. Cuộc trò chuyện gốc được khôi phục như cũ.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Cách hoạt động          | Gửi ngữ cảnh đầy đủ đến LLM để tóm tắt | Xử lý trước bản ghi, đọc trực tiếp |
| LLM call                | Bắt buộc (thường 100K+ token)    | 0                                |
| Chi phí token           | Cao                               | 0                                |
| Mất thông tin           | Có (tóm tắt 3,3%)                 | Không (bản gốc được giữ)         |
| Tốc độ xử lý            | Hàng chục giây                    | < 1 giây (kể cả file 60MB+)      |
| Khi cache hết hạn       | Chi phí full re-cache cộng thêm  | Không ảnh hưởng                  |
| Khôi phục đa phiên      | Không thể                         | Được hỗ trợ                       |

Sử dụng: `/clear` rồi `/s-continue`. Bạn sẽ thấy danh sách các phiên trước. Chọn một để khôi phục. Để khôi phục nhanh: `/s-continue last`.

**Kết quả:** Tiếp tục công việc trước đó với chi phí bằng không. Không mất thông tin. Xử lý bản ghi 60MB+ trong dưới 1 giây.

### 🤝 Người bạn đồng hành: `/s-compact` — bàn giao lớp ẩn

`/s-continue` khôi phục **transcript** — những gì bạn và Claude đã nói. Nhưng kiến thức hữu ích nhất của một phiên làm việc thường nằm **ngoài** cuộc đối thoại đó: những gì một **subagent** tìm thấy (transcript của nó là một file riêng mà việc khôi phục không bao giờ tải), một **con số quyết định trong kết quả công cụ** (số lượng test, chỉ số benchmark), một **bài học rút ra từ quá trình** ("không tái hiện được ở chế độ headless → hóa ra là do build, không phải do code").

Chạy `/s-compact` vào cuối phiên và nó sẽ chắt lọc chính xác lớp ẩn đó thành một bản bàn giao, lưu vào `~/.claude/super-token-saver-data/<project>/handoff.md`. Ở phiên tiếp theo, `/s-continue` sẽ **tự động tải** nó lên trên transcript đã khôi phục — không cần dán thủ công.

|                     | Chỉ `/s-continue`            | `/s-compact` + `/s-continue` (cả bộ)          |
| Khôi phục            | Transcript (những gì đã nói)  | Transcript cộng lớp ẩn             |
| Phát hiện của subagent   | Mất (file riêng)           | Được chắt lọc vào bản bàn giao                       |
| Số liệu từ kết quả công cụ | Chỉ khi được trích dẫn vào chat    | Được trích xuất có chủ đích                            |
| Bài học quá trình     | —                               | Được ghi lại để không lặp lại ngõ cụt              |

**Quy trình:** kết thúc một phiên bằng `/s-compact` → bắt đầu phiên tiếp theo bằng `/s-continue`.

### 🔀 Hai công cụ, một lịch sử — phiên Codex cũng được khôi phục ở đây

Codex ghi các phiên của nó vào `~/.codex/sessions/`; Claude Code ghi vào `~/.claude/projects/`. Không công cụ nào đọc được file của công cụ kia. Vì vậy một sprint hết ngân sách giữa chừng trong Codex trước đây không thể truy cập được từ Claude Code, và ngược lại cũng vậy.

`/s-continue` giờ liệt kê và khôi phục được cả hai. Rollout của Codex không được giao cho một parser thứ hai xử lý — mà được viết lại theo đúng khuôn dạng Claude Code sử dụng, **một dòng output cho mỗi dòng input**, nhờ đó cùng một pipeline phục vụ được cả hai công cụ, và mỗi marker `L{n}` vẫn trỏ đúng đến dòng gốc trong file Codex ban đầu. Đo được: một rollout 12 MB, 1,540 dòng được tiền xử lý trong **0.13 s**.

|                        | Phiên Claude Code | Phiên Codex |
| ---------------------- | ------------------- | ------------- |
| Được liệt kê bởi `/s-continue` | Có | Có, giới hạn trong project hiện tại |
| Khôi phục với chi phí LLM bằng không | Có | Có |
| Tìm bằng `L{n}` về file gốc | Có | Có — số dòng là của chính rollout đó |
| Khôi phục khi mất ngữ cảnh (`#0`) | `/compact`, auto-compact | Cơ chế nén và khôi phục thread riêng của Codex |
| Bàn giao `/s-compact` | Dùng chung theo từng project — ghi ở công cụ này, tải ở công cụ kia |

```
/s-continue codex                    chỉ các phiên Codex
/s-continue codex : rust migration   các turn khớp với một chủ đề, được khôi phục đầy đủ
```

Hai chi tiết tạo nên khác biệt giữa một danh sách đúng và một danh sách trông có vẻ đúng nhưng lại sai: `session_id` của Codex thực chất là id của **thread**, thứ mà một subagent được tạo ra sẽ kế thừa, nên các phiên được đánh khóa theo `payload.id` và rollout của subagent bị lọc bỏ theo đúng cách mà transcript của subtask trong Claude Code đã bị lọc bỏ từ trước. Còn `<codex_internal_context source="goal">` được hệ thống tự động chèn vào, nên nó vẫn được giữ lại trong ngữ cảnh khôi phục nhưng không bao giờ được tính là một turn do bạn gõ ra.

Plugin này cũng được cài đặt vào Codex — xem **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)). `usage-view`, `report-limit` và `setup-statusline` hiện tại vẫn chỉ dành riêng cho Claude Code.

---

## 📊 Tính năng 3: Live Status Line

**Theo dõi token/chi phí theo thời gian thực. Overhead dưới 50ms.**

Chạy `/setup-statusline install` một lần và thanh trạng thái liên tục xuất hiện ở cuối Claude Code.

**Hoạt động bình thường** — mọi chỉ số trong nháy mắt, không cần chuyển ngữ cảnh:

![Thanh trạng thái ở trạng thái bình thường](docs/images/statusline-normal.png)

**Khi bị giới hạn tốc độ** — 5H chuyển đỏ ở 102%, đếm ngược hiển thị chính xác khi bạn trở lại, và hành động `/report-limit` một chạm xuất hiện tự động:

![Thanh trạng thái khi bị giới hạn tốc độ](docs/images/statusline-rate-limited.png)

| Chỉ số           | Hiển thị gì                         | 🟢 Bình thường | 🟡 Cảnh báo | 🔴 Nguy hiểm |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Chi phí của API call cuối cùng     | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | Chi phí tích lũy cho thư mục này  | —         | —          | —           |
| 5H               | Sử dụng cửa sổ 5 giờ + đếm ngược reset | < 70%     | >= 70%     | >= 90%      |
| CTX              | Sử dụng cửa sổ ngữ cảnh           | < 35%     | >= 35%     | >= 70%      |

Khi bất kỳ chỉ số nào đạt cảnh báo hoặc nguy hiểm, gợi ý `→ /usage-view current` xuất hiện tự động.

Để gỡ bỏ: `/setup-statusline uninstall` (cấu hình trước đó được tự động khôi phục).

**Kết quả:** Mọi vấn đề chi phí hiển thị theo thời gian thực. Overhead dưới 50ms — không có độ trễ cảm nhận được.

> **Dùng API trả theo lượng?** Các chỉ số 5H và W tự động ẩn — bạn không có cửa sổ giới hạn tốc độ. Những gì hiển thị là những gì quan trọng: RUN (chi phí thời gian thực mỗi lượt) và CTX (kích thước ngữ cảnh). Hai đòn bẩy kiểm soát hóa đơn của bạn, luôn hiển thị.

---

## 📈 Bảng điều khiển sử dụng (/usage-view)

**Cuối cùng trả lời được: "Tất cả số tiền đó đi đâu?"**

Người dùng Max Plan gặp giới hạn tốc độ và tự hỏi tại sao. Người dùng API mở hóa đơn Anthropic và tự hỏi như thế nào. Dù cách nào, câu hỏi vẫn như nhau: phiên nào đốt nhiều token nhất? Khi nào chi phí tăng đột biến? Mẫu nào tồn tại trong cách dùng của bạn? Cho đến nay — tất cả đều vô hình.

`/usage-view` hiển thị tất cả. Bảng điều khiển HTML tương tác mở trong trình duyệt của bạn, cho phép phân tích mẫu sử dụng và truy tìm nguyên nhân gốc rễ của đột biến chi phí. Không phụ thuộc bên ngoài. Hoạt động độc lập. Có thể chia sẻ dưới dạng file.

**$4.196 trong 31 ngày. Tất cả đi đâu?** Một cái nhìn — tổng chi phí, phân tích token theo loại, tỷ lệ hiệu quả cache, và số lượng phiên. Biểu đồ donut ngay lập tức cho thấy 65% chi tiêu của bạn là cache read (bình thường và lành mạnh):

![Tổng quan bảng điều khiển sử dụng](docs/images/usage-view-overview.png)

**Trước và sau — đo lường, không phải đoán.** Dấu mốc "Plugin installed" màu cam đứt nét chia đôi mốc thời gian chi phí của bạn. Các thanh hàng ngày được xếp theo loại token (Input/Output/Cache Write/Cache Read) để bạn có thể thấy chính xác thành phần nào thay đổi sau khi cài đặt. Đường trung bình cho thấy xu hướng:

![Xu hướng chi phí hàng ngày](docs/images/usage-view-daily-trend.png)

**Bạn đốt nhiều nhất khi nào?** Chi phí theo giờ trong ngày và phân tích theo ngày trong tuần. Chuyển đổi giữa trung bình ngày hoạt động, trung bình tất cả các ngày, hoặc tối đa. Biểu tượng lửa đánh dấu những giờ đắt nhất — các mẫu rõ ràng (làm đêm khuya, đột biến thứ Tư) hiện ra ngay lập tức:

![Mẫu chi phí theo giờ và ngày trong tuần](docs/images/usage-view-hourly-pattern.png)

**Bạn có đang hiệu quả hơn không?** Tỷ lệ Total/Output đo số token tiêu thụ trên mỗi output token tạo ra. Thấp hơn là tốt hơn. Dấu mốc "Plugin installed" cho phép so sánh trước và sau. Đột biến = cache miss hoặc khởi động lại phiên:

![Xu hướng hiệu quả](docs/images/usage-view-efficiency.png)

**Mỗi API call, vẽ theo kích thước ngữ cảnh và chi phí.** Đây là biểu đồ làm cấu trúc chi phí trở nên rõ ràng. Mỗi chấm là một API call. Đỏ = Opus, xanh lam = Sonnet, xanh lá = Haiku. Các đường đứt nét là giá lý thuyết — nếu chấm của bạn nằm trên đường, bạn đang trả quá nhiều. Chuyển sang chế độ **User Turn** để xem chi phí mỗi lượt trò chuyện thay vì mỗi API call.
Di chuột vào bất kỳ chấm nào để xem văn bản prompt thực tế, số token, và phân tích chi phí đầy đủ (Input/Output/Cache Write/Cache Read):

![Chi phí theo Kích thước ngữ cảnh — biểu đồ phân tán](docs/images/usage-view-cost-scatter.png)

**Ngữ cảnh của bạn lớn đến mức nào?** Hầu hết các call tập trung dưới 250K. Phần đuôi dài trên 350K là nơi chi phí bùng nổ — biểu đồ này cho thấy chính xác bạn thường xuyên ở vùng nguy hiểm như thế nào:

![Phân phối Kích thước ngữ cảnh](docs/images/usage-view-context-dist.png)

**Lịch code của bạn, tính giá theo giờ.** Bản đồ nhiệt cửa sổ 5 giờ trong 30 ngày. Xanh lá (<$15/h), cam ($15-30/h), đỏ ($30+/h). Biểu tượng đầu lâu (💀) đánh dấu các cửa sổ bạn đạt giới hạn tốc độ. Thanh trượt chi phí ở trên lọc ra các cửa sổ rẻ để những cửa sổ đắt nổi bật — kéo để tìm ngay những ngày tệ nhất. Chuyển đổi giữa chế độ xem cửa sổ 5 giờ và khối 1 giờ:

![Bản đồ nhiệt lịch sử dụng theo giờ](docs/images/usage-view-calendar.png)

**Nhấp vào bất kỳ ô nào để xem chi tiết các phiên trong cửa sổ đó.** Mỗi phiên trong khoảng thời gian đó, với chi phí, số tin nhắn, phân tích token, và các tin nhắn đầu/cuối thực tế từ mỗi cuộc trò chuyện. Mở rộng "Top Token Conversations" để xem những trao đổi cụ thể nào đốt nhiều nhất — mỗi mục hiển thị văn bản prompt, thẻ cảnh báo chi phí, và gợi ý tối ưu:

![Bảng chi tiết phiên](docs/images/usage-view-session-drilldown.png)

**Phân tích bằng AI (tùy chọn).** Khi bạn chạy `/usage-view` mà không có `--no-ai`, một nhà phân tích AI đọc toàn bộ dữ liệu bảng điều khiển của bạn — với tham chiếu giá API tích hợp — và tạo ra báo cáo bằng văn bản: nguyên nhân chi phí, bất thường, khuyến nghị tối ưu. Hiển thị bằng ngôn ngữ hệ điều hành của bạn tự động (23 ngôn ngữ, bao gồm RTL; biểu đồ/bảng luôn ở chế độ LTR):

**Tiền đi đâu** — tổng chi tiêu, nguyên nhân chi phí theo loại token, xu hướng hàng tuần, và tác động plugin được đo bằng số thực:

![Phân tích AI — phân tích chi phí](docs/images/usage-view-ai-report-1.png)

**Khi nào và cách bạn làm việc** — giờ cao điểm, ngày bận nhất, phân phối API call, và mẫu giới hạn tốc độ tiết lộ cơ hội tối ưu:

![Phân tích AI — mẫu làm việc](docs/images/usage-view-ai-report-2.png)

**Phải làm gì** — khuyến nghị cụ thể, dựa trên dữ liệu, phù hợp với cách dùng thực tế của bạn. Chuyển đổi model, quản lý ngữ cảnh, chiến lược phiên:

![Phân tích AI — khuyến nghị](docs/images/usage-view-ai-report-3.png)

**Chia sẻ nó.** Toàn bộ bảng điều khiển là một file HTML độc lập duy nhất — tất cả dữ liệu được nhúng, không cần máy chủ. Gửi cho nhóm, quản lý, hoặc kế toán của bạn. Không phụ thuộc bên ngoài. Hoạt động offline. Dùng chế độ `private` để xóa tất cả văn bản prompt trước khi chia sẻ — giữ nguyên phân tích chi phí trong khi xóa nội dung cuộc trò chuyện.

```
/usage-view                  # Tất cả thời gian, tất cả dự án
/usage-view current          # Chỉ cửa sổ 5 giờ hiện tại
/usage-view last 7 days      # 7 ngày qua
/usage-view locale ja        # Tiếng Nhật
/usage-view --no-ai          # Bỏ qua phân tích AI (nhanh hơn)
/usage-view private          # Xóa văn bản prompt (an toàn để chia sẻ)
```

---

## 🔬 Nghiên cứu giới hạn tốc độ (/report-limit)

**Dự án cộng đồng để dịch ngược công thức giới hạn tốc độ.**

Anthropic không công bố công thức chính xác cho cửa sổ 5 giờ. Hãy cùng tìm hiểu.

Khi bạn đạt giới hạn tốc độ, chạy `/report-limit`. Dữ liệu sử dụng hiện tại của bạn được tự động gửi dưới dạng GitHub Discussion. Càng nhiều dữ liệu chúng ta thu thập, công thức càng rõ ràng hơn.

---

## ✂️ Tính năng 4: /setup-git-lite — Cắt bỏ hướng dẫn git tích hợp của CC

**Chúng tôi đã đọc mã nguồn Claude Code. Chúng tôi tìm thấy 2.200 token ẩn được đưa vào mỗi phiên mà bạn đang âm thầm trả tiền.**

### Phát hiện

Ngày 2026-04-12, một [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) tiết lộ rằng cài đặt `includeGitInstructions` tích hợp của Claude Code âm thầm đốt token mỗi phiên. Tái hiện độc lập qua [gist này (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) xác nhận các con số: **+6.031 token trong cache write** mỗi phiên sau mỗi git commit, **+1.690 token trong cache read** trên mỗi API call.

### Phân tích mã nguồn CC — token đi đâu

Chúng tôi đã truy tìm token đến hai điểm đưa vào độc lập trong mã nguồn Claude Code (v2.1.88):

**1. Snapshot `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` thu thập branch + main branch + user.name + trạng thái đầy đủ (tối đa 2000 ký tự) + **5 commit gần đây**
- Được nối và thêm vào system prompt qua `appendSystemContext` (`utils/api.ts:437`)
- Mỗi commit mới, mỗi file được sửa đổi mới, mỗi lần chuyển nhánh thay đổi văn bản → prefix cache invalidation

**2. Hướng dẫn quy trình Commit/PR (~1.700 tok) — mô tả công cụ Bash**
- `tools/BashTool/prompt.ts:53` thêm 60+ dòng giao thức an toàn, quy trình commit từng bước, ví dụ HEREDOC, và template tạo PR vào mô tả của công cụ `Bash`
- Được cache cùng system prompt, nhưng được gửi dưới dạng tham số `tools[]`

### Tại sao nó đắt

Cấu trúc cache (`utils/api.ts:321` `splitSysPromptPrefix`) có ba đường dựa trên việc bạn có công cụ MCP hoạt động hay không:

- **Đường A** (MCP hoạt động — hầu hết người dùng): `gitStatus` nằm trong khối `cacheScope: 'org'`. Bất kỳ thay đổi nào → toàn bộ khối được cache lại khi bắt đầu phiên tiếp theo → 6K tok `cache_create` miss.
- **Đường B** (không có MCP): `gitStatus` đến khối động `cacheScope: null`, nghĩa là nó được gửi lại dưới dạng `input_tokens` mới mỗi API call — không cache miss, nhưng cũng không tiết kiệm cache.
- **Đường C** (nhà cung cấp bên thứ 3 / betas thử nghiệm bị vô hiệu hóa): giống Đường A.

Trong các phiên tương tác thông thường, hướng dẫn commit/PR (1,7K tok) tích lũy **trên mỗi API call** qua `cache_read`. Trong một phiên 100 call ở giá Opus 4.7, đó là khoảng **$0,08 mỗi phiên** chỉ cho hướng dẫn mà quá trình đào tạo của Claude đã phần lớn bao gồm.

### super-token-saver xử lý thế nào

`/setup-git-lite` vô hiệu hóa đường gốc và đưa vào **thay thế 280 token được tối ưu** qua hook SessionStart. Chúng tôi giữ lại chính xác những gì ghi đè hành vi mặc định của Claude (quy tắc an toàn), và loại bỏ mọi thứ Claude đã biết từ quá trình đào tạo (quy trình từng bước, template PR, mẫu dùng gh).

**Giữ lại — 11 quy tắc ghi đè quan trọng** (những quy tắc chuyển đổi tính hữu ích mặc định của Claude thành thận trọng):
- Không bao giờ commit/push/amend/PR/tag/merge mà không có yêu cầu rõ ràng từ người dùng
- Không bao giờ bỏ qua hook, force-push lên main/master, chạy thao tác phá hủy, sửa git config
- Không bao giờ commit file khớp `.env`, `credentials`, `*.pem`, `secret.*`
- Tránh `git add -A` / `git add .`
- HEREDOC cho commit message nhiều dòng + trailer `Co-Authored-By: Claude`
- Không dùng cờ tương tác (-i), không commit rỗng
- Nếu hook pre-commit thất bại → tạo commit MỚI (không phải `--amend`)

**Đã loại bỏ** — quy trình commit từng bước (3 bước), quy trình PR từng bước (3 bước), template tiêu đề/nội dung PR, tham chiếu lệnh `gh`, cảnh báo cờ `-uall`, cảnh báo `--no-edit` với rebase, ràng buộc `NEVER use TodoWrite or Agent tools during commit`. Đây là những chi tiết quy trình mà Claude soạn thảo đúng chỉ từ quá trình đào tạo.

**Thêm vào** — dòng trạng thái git súc tích: branch + HEAD short-sha + subject + trạng thái hiện tại (tối đa 20 file đã sửa đổi, hoặc số đếm). Không có danh sách commit gần đây (Claude có thể chạy `git log` theo yêu cầu).

### Tiết kiệm dự kiến (giá Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Mục | Gốc | Với setup-git-lite | Tiết kiệm |
| ---- | -------- | ------------------- | ----- |
| Tải system prompt (mỗi phiên mới) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Các call lặp lại trong cùng phiên | ~1.700 tok cache_read/call | ~280 tok cache_read/call | ~1.420 tok/call |
| Phiên 100 call (Opus 4.7) | — | — | **~$0,11 tiết kiệm** |
| 20 phiên/ngày × 22 ngày làm việc | — | — | **~$48 tiết kiệm/tháng** |

### Sử dụng

```bash
/setup-git-lite status     # Chẩn đoán chỉ đọc — trạng thái hiện tại + những gì sẽ thay đổi
/setup-git-lite install    # Vô hiệu hóa CC gốc + kích hoạt hook tối giản của chúng tôi
/setup-git-lite revert     # Khôi phục mặc định (mạnh; xem bên dưới)
/setup-git-lite dismiss-banner    # Tắt gợi ý khuyến nghị thỉnh thoảng
/setup-git-lite undismiss-banner  # Bật lại gợi ý
/setup-git-lite help       # Hướng dẫn đầy đủ
```

### Ngữ nghĩa cài đặt

`install` sửa đổi **hai** nơi để đảm bảo tính ổn định:

1. `~/.claude/settings.json` — thêm `"includeGitInstructions": false`
2. Shell profile (`~/.zshrc`, `~/.bashrc`, v.v.) — thêm khối đánh dấu xuất `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Một trong hai là đủ để vô hiệu hóa CC gốc; chúng tôi đặt cả hai để ghi đè môi trường không vô tình kích hoạt lại hành vi gốc. Thay đổi shell chỉ có hiệu lực trong shell mới.

### Ngữ nghĩa revert — mạnh

`revert` **xóa TẤT CẢ export `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` khỏi shell profile của bạn**, bao gồm bất kỳ cái nào bạn đã thêm thủ công trước khi cài đặt skill này. Điều này có chủ đích — bạn đã chạy `revert`, vì vậy chúng tôi khôi phục mặc định sạch. Chúng tôi luôn tạo bản sao lưu có dấu thời gian của shell profile trước.

Nếu bạn cần biến env vì lý do không liên quan, hãy ghi chú lại trước khi chạy `revert` và thêm lại sau.

### Trước khi gỡ cài đặt super-token-saver

**Chạy `/setup-git-lite revert` trước**, hoặc bạn sẽ bị để lại với `includeGitInstructions: false` trong settings.json nhưng không có hook thay thế (Claude không nhận được hướng dẫn git nào cả). Claude Code hiện không có hook vòng đời gỡ cài đặt plugin, vì vậy chúng tôi không thể tự động hóa điều này.

### Đánh đổi

Những gì bạn mất (và tại sao thường không sao):
- Claude không còn nhận `git status` / `git log -n 5` được tính toán trước khi bắt đầu phiên. Nếu bạn hỏi "có gì thay đổi?" trong phiên mới, Claude sẽ tự chạy những lệnh đó (thêm một tool call, ~300 tok).
- Claude không còn thấy quy trình commit chuẩn 3 bước của CC. Trong thử nghiệm của chúng tôi qua hàng trăm quy trình commit, kiến thức ở cấp độ đào tạo xử lý được các trường hợp quan trọng (định dạng HEREDOC, không `--amend`, không force-push) vì chúng tôi giữ những quy tắc đó dưới dạng quy tắc rõ ràng.
- Template nội dung PR (`## Summary` + `## Test plan`) không được đưa vào. Nếu bạn quan tâm đến chính xác định dạng đó, đặt nó trong CLAUDE.md của dự án.

### Banner khuyến nghị

Khi hướng dẫn git gốc CC vẫn còn hoạt động trên máy của bạn, super-token-saver hiển thị gợi ý một đoạn khi bắt đầu phiên **~20% thời gian** (cộng thêm trong đầu ra `/usage-view` và `/report-limit`). Tắt vĩnh viễn với `/setup-git-lite dismiss-banner`.

---

## 🛡️ Tính năng 5: Token Guardian

**Báo cho bạn ngay khoảnh khắc cache hết hạn khiến bạn tốn tiền. Có thể chặn khoản re-send $9 nếu bạn yêu cầu.**

Prompt cache của Claude Code tồn tại trong 1 giờ. Rời đi lâu hơn thế là nó hết hạn. Tin nhắn tiếp theo của bạn gửi lại toàn bộ ngữ cảnh với giá đầy đủ. Với 900K token, đó là $9 trong một lần.

Token Guardian nhớ thời điểm phản hồi cuối cùng đến. Nếu đã qua hơn 3.590 giây (TTL trừ đi bộ đệm 10 giây), nó có thể can thiệp. **Nhưng theo mặc định nó bị tắt, vì Remote Control.** Thông báo chặn của một hook được hiển thị cục bộ như một tin nhắn hệ thống mà client từ xa không bao giờ nhận được, nên một người dùng từ xa thấy prompt biến mất mà không có lời giải thích nào. Thay vì đưa ra một lớp bảo vệ hoạt động khác nhau tùy vào nơi bạn ngồi, chúng tôi đã tắt nó đi. Khi Remote Control bắt đầu chuyển tiếp được thông báo từ hook, mặc định sẽ bật trở lại. Cho đến lúc đó, bạn tự bật nó lên bằng một trong hai chế độ.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude nhắc đến việc hết hạn ngay dòng đầu phản hồi
export CC_TOKEN_SAVER_CACHE_GUARD=block   # prompt bị từ chối một lần với thông báo bên dưới
```

Ở chế độ `warn`, prompt vẫn đi qua, và Claude mở đầu phản hồi bằng một dòng cho biết cache đã hết hạn, lượt này bị tính phí như một lần gửi lại toàn bộ, và nếu nghỉ từ một giờ trở lên thì cách rẻ hơn để quay lại là `/clear` → `/s-continue`. Thông báo này thực sự đến được client từ xa, vì phản hồi của Claude vẫn được chuyển tiếp dù thông báo từ hook thì không.

Ở chế độ `block`, prompt bị từ chối một lần với thông báo bên dưới. Gửi lại lần nữa thì nó đi qua. Dùng chế độ này trong terminal cục bộ khi bạn muốn có sự dừng cứng.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

Thông báo chặn hiển thị bằng 23 ngôn ngữ, được chọn theo locale hệ điều hành của bạn, và chỉ xuất hiện một lần mỗi khoảng thời gian nghỉ.

**Các background agent không bao giờ bị chặn.** Chỉ những gì con người tự gõ mới nhận cảnh báo. Báo cáo hoàn thành từ các background agent và task -- vốn giờ đây thường xuyên đến sau hơn một giờ kể từ khi khởi chạy -- được chuyển qua trực tiếp, nên kết quả của một agent chạy lâu sẽ không bao giờ bị giữ lại hay mất đi.

**Kết quả:** ở chế độ warn, bạn luôn biết khi nào một khoản re-send $9 đã xảy ra, và vì sao. Ở chế độ block, điều đó không xảy ra: mỗi lần bắt được cache hết hạn = tiết kiệm $9, và một lần bắt mỗi ngày là $270/tháng lãng phí thuần túy được loại bỏ.

> **Nếu bạn dùng API trả theo lượng, điều này ảnh hưởng nặng hơn.** Người dùng Max Plan mất $9 trong giới hạn $200. Bạn mất $9 tiền thật — âm thầm, mỗi khi bạn rời đi. Token Guardian ở chế độ block chặn nó mỗi lần.

---

## 💡 Cách Cache thực sự hoạt động (và tại sao hầu hết người dùng lãng phí 40%+ vào đó)

Claude Code gửi toàn bộ lịch sử cuộc trò chuyện đến model trên mỗi API call. "API call" không có nghĩa là "một tin nhắn bạn đã gõ." Một prompt đơn lẻ kích hoạt các tool call nội bộ — Grep, Read, Edit, Write — và mỗi cái là một API call riêng biệt. Một prompt dễ dàng gây ra 10+ API call.

Prompt cache giảm chi phí này 90%. Nhưng cache có tuổi thọ.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 giờ (ephemeral_1h)                  | 5 phút                                 |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Khi cache hết hạn   | Ngữ cảnh đầy đủ được gửi lại với giá đầy đủ | Ít ảnh hưởng (ngữ cảnh nhỏ)         |

Ngay cả khi cache còn hoạt động, chi phí vẫn tích lũy. Đây là tình huống cực đoan để cho thấy sự khác biệt.

### Tình huống: Code cả ngày (3h sáng → 2h ăn trưa/họp → 3h chiều)

Điều kiện: Giá Opus 4, 1 prompt mỗi phút, ~5 API call mỗi prompt (~300 call/giờ).

#### ❌ Không có super-token-saver

Hầu hết công việc xảy ra trong Main session. Ngữ cảnh tăng nhanh.

| Giai đoạn   | Tình huống                        | Kích thước ngữ cảnh         | Chi phí                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Buổi sáng 3h  | Code (chủ yếu trong Main)       | 100K → 600K (TB 350K)      | 900 call × 350K × ＄0.50/M = ＄157.50  |
| Ăn trưa/họp   | Vắng mặt 2 giờ                 | —                          | —                                      |
| Trở về      | Cache hết hạn → gửi lại đầy đủ  | 600K giá đầy đủ            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Trở về      | /compact (tóm tắt)               | 600K → gửi đến LLM         | 600K × ＄0.50/M + output tóm tắt = ~＄1.50 |
| Buổi chiều 3h | Code tiếp tục (ngữ cảnh tái tăng) | 100K → 600K (TB 350K)   | 900 call × 350K × ＄0.50/M = ＄157.50  |
|             | Tổng cộng                        |                            | ~＄326                                  |

> Ở mức sử dụng này, bạn có thể sẽ đạt giới hạn tốc độ cửa sổ 5 giờ. **Chi phí tệ, nhưng vấn đề thực sự là công việc của bạn dừng hoàn toàn. Đây chính xác là lúc Claude Code tắt điện.**

#### ✅ Với super-token-saver

Công việc nặng được ủy thác cho SubTask. Main chỉ xử lý thiết kế/quyết định.

| Giai đoạn   | Tình huống                                   | Kích thước ngữ cảnh                | Chi phí                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Buổi sáng 3h  | Code (Main: thiết kế, SubTask: thực thi)  | Main 100K → 300K (TB 200K) | 900 call × 200K × ＄0.50/M = ＄90 |
| Ăn trưa/họp   | Vắng mặt 2 giờ                           | —                           | —                                  |
| Trở về      | ⚡ Token Guardian (chế độ block) → /clear + /s-continue | —                           | ＄0 (không LLM call)               |
| Buổi chiều 3h | Code tiếp tục                             | Main 100K → 300K (TB 200K) | 900 call × 200K × ＄0.50/M = ＄90 |
|             | Tổng cộng                                    |                             | ~＄180                              |

#### 💰 Kết quả

> **＄326 → ＄180. Tiết kiệm ＄146 mỗi ngày. Giảm 45% chi phí.**
>
> **Max Plan:** Ít token hơn = bạn không đạt giới hạn tốc độ. Công việc của bạn không dừng lại. Đó là sự khác biệt thực sự.
>
> **API trả theo lượng:** ＄146/ngày × 22 ngày làm việc = **＄3.200/tháng thẳng khỏi hóa đơn của bạn.** Một tháng nặng không có plugin này vượt ＄7.000. Với nó, dưới ＄4.000. Cùng đầu ra.

### Nơi super-token-saver can thiệp

```
[Session Start]
    │
    ├─ Session Architect → Tự động đưa vào mẫu ủy thác SubTask
    │                       Giữ ngữ cảnh Main dưới 250K
    │
[Đang làm việc]
    │
    ├─ Status Line → Theo dõi chi phí/ngữ cảnh/giới hạn tốc độ thời gian thực
    │                  Cảnh báo ngay lập tức khi vào vùng cảnh báo
    │
[Nghỉ hơn 1 giờ]
    │
    ├─ Token Guardian → Phát hiện cache hết hạn, cảnh báo (hoặc chặn ở chế độ block)
    │
[Khởi động lại phiên]
    │
    └─ /s-continue → Khôi phục ngữ cảnh trước đó với chi phí bằng không (không LLM call)
```

---

## 🔧 Cài đặt từ nguồn & Tùy chỉnh

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver hoàn toàn mã nguồn mở (Apache-2.0). JavaScript thuần + Bash — không có binary đã biên dịch, không có API call bên ngoài, không có telemetry. Mỗi dòng có thể kiểm tra. Mỗi tuyên bố trong README này ánh xạ đến một file cụ thể bạn có thể đọc.

- **hooks/** — Thay đổi ngưỡng hết hạn cache, tùy chỉnh thông báo cảnh báo, sửa đổi quy tắc kiến trúc phiên
- **scripts/** — Logic phân tích, trình tạo báo cáo, định dạng thanh trạng thái
- **skills/** — Cách /s-continue và /usage-view hoạt động, template prompt
- **locales/** — Thêm/chỉnh sửa bản dịch, thêm ngôn ngữ mới
- **skills/usage-view/** — Thay đổi thiết kế UI/UX bảng điều khiển

Làm cho nó của bạn. Fork, thử nghiệm, và gửi PR nếu bạn tìm thấy thứ gì đó tốt hơn.

---

## 🌐 Ngôn ngữ được hỗ trợ

23 ngôn ngữ được hỗ trợ. Được chọn bằng cách tham chiếu chéo 20 quốc gia hàng đầu theo lượng dùng Claude Code với 20 ngôn ngữ hàng đầu theo số người nói toàn cầu. Ngôn ngữ hiển thị được tự động phát hiện từ locale hệ điều hành của bạn. Bạn cũng có thể chỉ định thủ công: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Các bản dịch hiện tại được tạo bởi AI. Đóng góp từ người nói bản ngữ được hoan nghênh — chỉnh sửa file JSON cho ngôn ngữ của bạn trong `locales/` và gửi PR.

---

## ⚖️ Plugin này tốn gì của bạn

Plugin đưa ngữ cảnh vào khi bắt đầu phiên. Đây là chính xác bao nhiêu:

| Đưa vào | Khi nào | Token | Mục đích |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (một lần) | ~1.100 | Chiến lược ủy thác SubTask + quy tắc concise mode |
| Ngữ cảnh git (nếu git-lite được bật) | SessionStart (một lần) | ~280 | Thay thế hướng dẫn git gốc ~2.200 tok của CC |
| Cảnh báo hết hạn cache | Khi nghỉ > 59 phút (một lần) | ~200 | Báo hiệu khoản re-send đắt tiền, chỉ ra lối đi rẻ hơn |
| Status line | Mỗi API call | 0 | Render vào thanh trạng thái terminal, không phải ngữ cảnh cuộc trò chuyện |

**Overhead ròng mỗi phiên: ~1.400 token (một lần, được cache sau call đầu tiên).**

Ở giá Opus ($0,50/MTok cache read), đó là **$0,0007 mỗi API call** — chưa đến một phần mười của một xu. Trong một phiên 100 call: $0,07.

Nếu git-lite được bật, plugin **tiết kiệm** ~1.920 token mỗi phiên (thay thế 2.200 bằng 280). Hiệu ứng ròng là âm — plugin tiêu thụ ít hơn những gì nó loại bỏ.

**Đối với người dùng API trả theo lượng:** với chi tiêu $3.000/tháng, overhead plugin dưới $2/tháng. Chỉ riêng việc tiết kiệm từ ngăn chặn cache hết hạn (một lần chặn re-send $9 mỗi tuần) trả đủ chi phí overhead một năm chỉ trong một lần bắt.

---

## 💡 Mẹo

### Hiểu cache và bạn sẽ thấy tiền đi đâu

- **1 prompt ≠ 1 API call.** Mỗi lần Claude gọi Grep, Read, hoặc Edit, toàn bộ ngữ cảnh được gửi lại. Một prompt đơn lẻ dễ dàng kích hoạt 10+ API call. Viết prompt rõ ràng để giảm tool call không cần thiết và cắt giảm chi phí.
- **Bộ đếm thời gian cache reset từ API call cuối cùng, không phải prompt cuối cùng của bạn.** Tiếp tục làm việc và cache không bao giờ hết hạn. Nguy hiểm là rời đi. Token Guardian báo cho bạn biết khi nào điều đó xảy ra, và ở chế độ `block` sẽ chặn prompt một lần để bạn chọn: reset ngữ cảnh hoặc tiếp tục như cũ.
- **Kích thước ngữ cảnh = hệ số nhân chi phí.** Cùng API call ở 200K so với 800K tốn gấp 4 lần. Khi status line [CTX] vượt 35% (🟡), đó là tín hiệu để ủy thác nhiều hơn cho SubTask.

### Thói quen cắt giảm chi phí

- **Giữ CLAUDE.md gọn nhẹ.** Nó tải vào system prompt trên mỗi API call. Mỗi dòng tốn tiền.
- **Ủy thác công việc nặng cho SubTask.** Tạo code, chỉnh sửa đa file, chạy test không thuộc về Main. SubTask có ngữ cảnh nhỏ hơn và cache tier rẻ hơn.
- **Vắng mặt 1+ giờ?** `/clear` → quay lại → `/s-continue`. Ngữ cảnh được khôi phục với $0.
- **[5H] trên 70% (🟡)?** Chậm lại. Chuyển sang công việc đánh giá nhẹ hoặc tăng ủy thác SubTask để giảm số API call của Main.
- **Dùng `/btw` cho câu hỏi phụ.** Nó không đi vào lịch sử cuộc trò chuyện, vì vậy ngữ cảnh của bạn vẫn gọn nhẹ.

### API trả theo lượng: những thói quen quan trọng nhất

Tất cả những điều trên đều áp dụng, cộng thêm những ưu tiên riêng cho API:

- **Theo dõi [CTX] như đồng hồ tốc độ.** Không có giới hạn tốc độ nào sẽ dừng bạn — nhưng ngữ cảnh ở 500K+ có nghĩa là mỗi API call tốn gấp 2-3 lần so với nên là. `/clear` → `/s-continue` là miễn phí và reset hệ số nhân chi phí về mức cơ sở.
- **Chạy `/usage-view` hàng tuần.** Người dùng Max Plan có thời điểm "ối" tự nhiên khi bị giới hạn tốc độ. Bạn thì không — chi phí tăng âm thầm. Bảng điều khiển là hệ thống cảnh báo sớm của bạn.
- **Đặt ngân sách hàng ngày trong đầu.** Không có giới hạn, những ngày $200 xảy ra mà không chú ý. Chỉ số RUN trên status line làm chi phí mỗi lượt hiển thị. Nếu một lượt đơn vượt $1 (🔴), ngữ cảnh của bạn quá lớn.

---

## 📚 Tài liệu

- [Hướng dẫn Prompt Cache](guides/prompt-cache-guide.md) — Tại sao hầu hết chi phí của bạn là cache, cách hoạt động của caching trên các nhà cung cấp (Anthropic, OpenAI, Gemini), và cách quản lý nó ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Phân tích chi phí Fable 5.1 vs Opus 5](guides/fable-5-1-vs-opus-5-cost-analysis.md) — Rẻ hơn Opus 5 ít nhất 24–38% ở cùng chất lượng, qua 2.782 phiên
- [Phân tích chi phí Fable 5.1 vs Opus 5 (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Phân tích chi phí Opus 4.7 vs 4.6](guides/opus-4-7-vs-4-6-cost-analysis.md) — So sánh chi phí song song qua 8.563 API call
- [Phân tích chi phí Opus 4.7 vs 4.6 (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## Giấy phép

Apache-2.0
