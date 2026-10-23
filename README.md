# zhiyu-check

Claude Code 的 PreToolUse hook：寫入前擋下支語（中國大陸用語）與簡體字，請模型改成台灣用語後重寫。

## 運作方式
- 只檢查這次要寫進去的內容（Write 的 `content`、Edit 的 `new_string`、NotebookEdit 的 `new_source`），不掃既有檔案，不會被舊檔卡住。
- Bash／PowerShell 只在指令看起來會寫檔（heredoc、`>`、`tee`、`Set-Content`、`Add-Content`、`Out-File`）時檢查，單純搜尋不擋。
- 命中詞庫或含簡體字就回傳 `deny`，理由列出每個命中的詞與建議用語。
- 檔名以 `zhiyu-` 開頭的檔案不檢查（本工具的程式與詞庫本身就寫滿了支語）。
- 沒擋的時候不輸出任何東西，不花 token。

## 詞庫（三層，後面的可以增減前面的）
1. `zhiyu-words.txt`：預設詞庫，跟 `zhiyu-check.js` 放在同一個目錄。
2. `zhiyu-words.local.txt`：個人增減，放在同一個目錄；不進 repo，更新工具時不會被覆蓋。
3. 專案的 `.claude/zhiyu-allow.txt`：只在該資料夾與子資料夾生效的特例，從寫入的檔案位置和工作目錄往上找，跟著專案走、專案刪掉特例就跟著消失。

語法（三層相同）：
- `支語<TAB>建議用語`：加一組，建議用語可省略。
- `!詞組`：只放行該詞組，詞組以外的同一個詞照擋（例：放行一段必須逐字保留的法規原文）。
- `-支語`：停用一組（例：某個專案把該詞定義成正式術語）。
- `#` 開頭是註解。
- 長詞命中時，不再重複回報它包含的短詞。

## 特例放哪裡
- 只跟某個專案有關（術語、原文引用、課程名稱）：放該專案的 `.claude/zhiyu-allow.txt`。
- 跟專案無關的個人習慣：放 `zhiyu-words.local.txt`。
- 對所有人都成立的修正：改 `zhiyu-words.txt` 並提交。

## 安裝
1. 把 `zhiyu-check.js` 與 `zhiyu-words.txt` 放到 `~/.claude/zhiyu-check/`。
2. 在 `~/.claude/settings.json` 的 `hooks.PreToolUse` 加入：

```json
{
  "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell",
  "hooks": [
    {
      "type": "command",
      "command": "node ~/.claude/zhiyu-check/zhiyu-check.js",
      "timeout": 10,
      "statusMessage": "檢查支語用詞"
    }
  ]
}
```

- 需要 Node.js。
- Windows 上 `~` 不一定會展開，`command` 請換成實際的絕對路徑。
- 用 [toolkeeper](https://github.com/94sh09sh19sh/toolkeeper) 管理時，`deploy zhiyu-check` 會自動完成以上兩步。

## 已知限制
- 簡體字只比對一組常見字，不是完整的簡繁對照。
- 純字串比對、不分詞；誤擋時用 `!` 放行詞組處理。
- 必須逐字保留的原文引用或第三方欄位名也會被擋；擋下訊息會請模型改問使用者，不要反覆重試。
