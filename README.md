# zhiyu-check

Claude Code 的 PreToolUse hook：寫入前擋下支語（中國大陸用語）與簡體字，請模型改成台灣用語後重寫。

## 運作方式
- 只檢查這次要寫進去的內容（Write 的 `content`、Edit 的 `new_string`、NotebookEdit 的 `new_source`），不掃既有檔案，不會被舊檔卡住。
- Bash／PowerShell 只在指令看起來會寫檔（heredoc、`>`、`tee`、`Set-Content`、`Add-Content`、`Out-File`）時檢查，單純搜尋不擋。
- 命中詞庫或含簡體字就回傳 `deny`，理由列出每個命中的詞與建議用語。
- 路徑含 `/.claude/hooks/` 的檔案不檢查（詞庫本身寫滿了支語）。

## 詞庫（zhiyu-words.txt）
- 一行一組：`支語<TAB>建議用語`，建議用語可省略。
- `#` 開頭是註解；想放行某個詞，刪掉或註解掉那行。
- `!` 開頭是放行詞組：只放行該詞組，詞組以外的同一個詞照擋。
- 長詞命中時，不再重複回報它包含的短詞。
- 詞庫必須和 `zhiyu-check.js` 放在同一個目錄；找不到詞庫時只做簡體字檢查。

## 安裝
1. 把 `zhiyu-check.js` 與 `zhiyu-words.txt` 放到 `~/.claude/hooks/`。
2. 在 `~/.claude/settings.json` 的 `hooks.PreToolUse` 加入：

```json
{
  "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell",
  "hooks": [
    {
      "type": "command",
      "command": "node ~/.claude/hooks/zhiyu-check.js",
      "timeout": 10,
      "statusMessage": "檢查支語用詞"
    }
  ]
}
```

- 需要 Node.js。
- Windows 上 `~` 不一定會展開，`command` 請換成實際的絕對路徑。

## 已知限制
- 簡體字只比對一組常見字，不是完整的簡繁對照。
- 純字串比對、不分詞；誤擋時用 `!` 放行詞組處理。
- 必須逐字保留的原文引用或第三方欄位名也會被擋；擋下訊息會請模型改問使用者，不要反覆重試。
