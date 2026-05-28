// DOM rendering (replaces Vue components)
import { get, set } from "./state.js";
import * as api from "./api.js";
import { getProviderEmoji, shortHost, formatDate } from "./providers.js";
import { show } from "./toaster.js";

// ========== Sidebar ==========

export function initSidebar(onNavigate) {
  const items = document.querySelectorAll(".nav-item");
  for (const item of items) {
    item.addEventListener("click", () => {
      const page = item.dataset.page;
      items.forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
      onNavigate(page);
    });
  }
}

// ========== Navigate to page ==========

export function navigateTo(page) {
  set("currentPage", page);

  // Update sidebar active
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === page);
  });

  // Update page visibility
  document.querySelectorAll(".page").forEach((el) => {
    el.classList.toggle("active", el.id === `page-${page}`);
  });
}

// ========== Profiles Page ==========

export function renderProfilesPage() {
  const container = document.getElementById("cardsContainer");
  const profiles = get("profiles");
  const search = get("searchQuery");

  if (!profiles || profiles.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚙</div>
        <h3>暂无配置方案</h3>
        <p>点击「新建方案」创建第一个配置方案</p>
      </div>
    `;
    return;
  }

  const filtered = search
    ? profiles.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.provider.toLowerCase().includes(search.toLowerCase()) ||
          p.baseUrl.toLowerCase().includes(search.toLowerCase()),
      )
    : profiles;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <h3>无匹配结果</h3>
        <p>没有匹配 "${esc(search)}" 的配置方案</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((p) => {
      const isActive = p.isActive;
      return `
      <div class="profile-card ${isActive ? "active" : ""}" data-id="${p.id}">
        <div class="card-header">
          <span class="card-title">${getProviderEmoji(p.provider)} ${esc(p.name)}</span>
          ${isActive ? '<span class="card-badge">使用中</span>' : ""}
        </div>
        <div class="card-info">
          <div>${PROVIDER_NAME(p.provider)}</div>
          <div class="url">${esc(shortHost(p.baseUrl))}</div>
          <div>${esc(p.model)}</div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm ${isActive ? "btn-success" : "btn-primary pill"}" data-action="switch" data-id="${p.id}">
            ${isActive ? "✓ 已激活" : "切换"}
          </button>
          <button class="btn btn-sm pill" data-action="edit" data-id="${p.id}">编辑</button>
          <button class="btn btn-sm btn-danger pill" data-action="delete" data-id="${p.id}">删除</button>
        </div>
      </div>
    `;
    })
    .join("");

  // Bind events
  container.querySelectorAll(".profile-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) return;
      // Click card body -> show detail
      const id = card.dataset.id;
      showDetailPage(id);
    });

    const switchBtn = card.querySelector('[data-action="switch"]');
    switchBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      handleSwitch(switchBtn.dataset.id);
    });

    const editBtn = card.querySelector('[data-action="edit"]');
    editBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      showEditorPage(editBtn.dataset.id);
    });

    const deleteBtn = card.querySelector('[data-action="delete"]');
    deleteBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDelete(deleteBtn.dataset.id);
    });
  });
}

function PROVIDER_NAME(provider) {
  const map = {
    anthropic: "Anthropic",
    openrouter: "OpenRouter",
    deepseek: "DeepSeek",
    ollama: "Ollama",
    vllm: "vLLM",
    custom: "自定义",
  };
  return map[provider] || provider;
}

// ========== Switch Profile ==========

async function handleSwitch(id) {
  set("isSwitching", true);
  const result = await api.switchProfile(id);
  set("isSwitching", false);

  if (result.success) {
    show("success", result.message);
    await loadProfiles();
  } else {
    show("error", `切换失败: ${result.error?.message || "未知错误"}`);
  }
}

// ========== Delete Profile ==========

async function handleDelete(id) {
  const profile = get("profiles").find((p) => p.id === id);
  if (!profile) return;

  if (!confirm(`确认删除方案"${profile.name}"？`)) return;

  const result = await api.deleteProfile(id);
  if (result) {
    show("success", `已删除方案"${profile.name}"`);
    await loadProfiles();
  }
}

// ========== Load Profiles ==========

export async function loadProfiles() {
  const profiles = await api.listProfiles();
  set("profiles", profiles);
  const active = profiles.find((p) => p.isActive);
  set("activeProfileId", active?.id || null);

  // Update status bar
  document.getElementById("activeProfileName").textContent = active?.name || "无";

  // Re-render current page
  const page = get("currentPage");
  if (page === "profiles") renderProfilesPage();
}

// ========== Editor Page ==========

// All standard env fields with labels, descriptions, and capability requirements
const ENV_FIELDS = [
  {
    key: "ANTHROPIC_AUTH_TOKEN",
    label: "认证令牌",
    placeholder: "sk-...",
    type: "password",
    description: "API 请求的身份验证密钥。支持 sk- 或 t- 开头的密钥格式。",
    capability: null,
  },
  {
    key: "ANTHROPIC_BASE_URL",
    label: "基础 URL",
    placeholder: "https://api.anthropic.com",
    description: "API 端点的根 URL 地址。第三方服务（如 OpenRouter、DashScope）需要填写对应的兼容地址。",
    capability: null,
  },
  {
    key: "ANTHROPIC_MODEL",
    label: "主模型",
    placeholder: "claude-sonnet-4-20250514",
    description: "Claude Code 默认使用的主模型。用于所有核心对话、代码生成、文件编辑和复杂推理任务。",
    capability: "文本生成 · 代码编写 · 复杂推理 · 长上下文理解",
  },
  {
    key: "ANTHROPIC_SMALL_FAST_MODEL",
    label: "快速小模型",
    placeholder: "claude-haiku-4-5-20251001",
    description: "用于轻量级任务：意图分类、工具调用路由、简单格式化等。要求低延迟、低成本。",
    capability: "快速响应 · 意图分类 · 工具路由 · 简单文本处理",
  },
  {
    key: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    label: "默认 Haiku 模型",
    placeholder: "claude-haiku-4-5-20251001",
    description: "Haiku 级别模型的默认值。用于不需要强推理能力的日常任务，如文件读取、简单问答。",
    capability: "文本生成 · 基础理解 · 快速响应 · 低成本任务",
  },
  {
    key: "ANTHROPIC_DEFAULT_SONNET_MODEL",
    label: "默认 Sonnet 模型",
    placeholder: "claude-sonnet-4-20250514",
    description: "Sonnet 级别模型的默认值。平衡性能与质量，适用于中等复杂度的代码分析和编辑任务。",
    capability: "代码分析 · 中等推理 · 文本生成 · 多步任务",
  },
  {
    key: "ANTHROPIC_DEFAULT_OPUS_MODEL",
    label: "默认 Opus 模型",
    placeholder: "claude-opus-4-7",
    description: "Opus 级别模型的默认值。最强推理能力，适用于复杂架构分析、大规模重构和深度推理。",
    capability: "深度推理 · 复杂代码分析 · 架构设计 · 多模态理解",
  },
  {
    key: "CLAUDE_CODE_SUBAGENT_MODEL",
    label: "子代理模型",
    placeholder: "claude-haiku-4-5-20251001",
    description: "Claude Code 启动子 Agent（subagent）时使用的模型。子代理用于并行独立任务，如文件搜索、代码审查。建议使用快速小模型以控制成本。",
    capability: "独立任务执行 · 文件搜索 · 代码审查 · 并行处理",
  },
];

export function showEditorPage(profileId = null) {
  set("currentPage", "editor");
  set("editingProfile", profileId);

  // Hide all pages, show editor
  document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
  document.getElementById("page-editor").classList.add("active");

  const container = document.getElementById("editorContainer");
  const profile = profileId ? get("profiles").find((p) => p.id === profileId) : null;

  const title = profile ? "编辑配置方案" : "新建配置方案";

  // Build provider options
  const providerOptions = Object.entries({
    anthropic: "Anthropic",
    openrouter: "OpenRouter",
    deepseek: "DeepSeek",
    ollama: "Ollama",
    vllm: "vLLM",
    custom: "自定义",
  })
    .map(([key, label]) => `<option value="${key}" ${profile?.provider === key ? "selected" : ""}>${label}</option>`)
    .join("");

  // Get env values from profile
  const env = profile?.env || {};
  const model = env.ANTHROPIC_MODEL || profile?.model || "";
  const baseUrl = env.ANTHROPIC_BASE_URL || profile?.baseUrl || "";

  // Build standard env field inputs with descriptions and capabilities
  const envFieldsHtml = ENV_FIELDS
    .map((field) => {
      const val = env[field.key] || "";
      const isPassword = field.key === "ANTHROPIC_AUTH_TOKEN";
      const inputType = isPassword ? "password" : "text";
      const descHtml = field.description
        ? `<div class="env-field-desc">${esc(field.description)}</div>`
        : "";
      const capHtml = field.capability
        ? `<div class="env-field-cap">${esc(field.capability)}</div>`
        : "";
      return `
        <div class="form-group env-field" data-env-key="${field.key}">
          <label for="env_${field.key}">${field.label} <span style="color:var(--color-ink-muted);font-weight:400;">(${field.key})</span></label>
          ${descHtml}
          ${capHtml}
          <div class="api-key-wrapper">
            <input class="form-input env-input" id="env_${field.key}" type="${inputType}" placeholder="${field.placeholder}" value="${esc(val)}" autocomplete="off" spellcheck="false" />
            ${isPassword ? '<button class="eye-toggle" type="button">👁</button>' : ""}
          </div>
        </div>
      `;
    })
    .join("");

  // Build custom env rows from env object (exclude standard keys)
  const standardKeys = new Set(ENV_FIELDS.map((f) => f.key));
  const customEntries = Object.entries(env).filter(([k]) => !standardKeys.has(k));

  let customEnvRows = "";
  for (const [k, v] of customEntries) {
    customEnvRows += buildEnvRowHtml(k, v);
  }

  // Build initial JSON preview
  const previewJson = buildPreviewJson(env);

  container.innerHTML = `
    <div class="editor-header">
      <h2>${title}</h2>
      <button class="btn pill" id="closeEditor">取消</button>
    </div>

    <div class="form-group">
      <label for="editorName">方案名称 *</label>
      <input class="form-input" id="editorName" type="text" placeholder="例如：Qwen DashScope" value="${profile ? esc(profile.name) : ""}" />
    </div>

    <div class="form-group">
      <label for="editorProvider">提供商</label>
      <select class="form-input" id="editorProvider">${providerOptions}</select>
    </div>

    <div class="env-section-title">环境变量 (env)</div>
    ${envFieldsHtml}

    <details class="advanced-toggle" id="advancedEnv">
      <summary>自定义环境变量 (${customEntries.length})</summary>
      <div style="margin-top: 8px;">
        <table class="env-table">
          <thead>
            <tr>
              <th>变量名</th>
              <th>值</th>
              <th style="width: 40px;"></th>
            </tr>
          </thead>
          <tbody id="envTableBody">${customEnvRows}</tbody>
        </table>
        <button class="add-env-btn" id="addEnvVar">+ 添加变量</button>
      </div>
    </details>

    <div class="preview-section">
      <div class="preview-header">
        <span>settings.json 预览</span>
        <span class="preview-hint">实时预览，仅显示 env 部分</span>
      </div>
      <pre class="preview-code" id="jsonPreview">${esc(previewJson)}</pre>
    </div>

    <div class="form-actions">
      <button class="btn pill" id="testConnectionBtn">测试连接</button>
      <button class="btn btn-primary pill" id="saveProfileBtn">保存方案</button>
    </div>

    <div id="testResult"></div>
  `;

  // Bind events
  document.getElementById("closeEditor").addEventListener("click", () => {
    navigateTo("profiles");
    renderProfilesPage();
  });

  document.getElementById("saveProfileBtn").addEventListener("click", () => saveProfile(profileId));

  document.getElementById("testConnectionBtn").addEventListener("click", () => testConnection());

  document.getElementById("addEnvVar").addEventListener("click", () => {
    const tbody = document.getElementById("envTableBody");
    const row = tbody.insertRow();
    row.innerHTML = buildEnvRowHtml("", "");
    bindDeleteBtn(row);
    updatePreview();
  });

  // Eye toggle buttons
  container.querySelectorAll(".eye-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrapper = btn.closest(".api-key-wrapper");
      const input = wrapper.querySelector("input");
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.textContent = isPassword ? "🙈" : "👁";
    });
  });

  // Live preview update: bind all inputs
  container.querySelectorAll(".env-input").forEach((input) => {
    input.addEventListener("input", updatePreview);
  });

  // Update summary line count
  updateCustomCount();
}

function buildEnvRowHtml(key = "", value = "") {
  return `<tr>
    <td><input class="env-key form-input" value="${esc(key)}" placeholder="变量名" spellcheck="false" /></td>
    <td><input class="env-value form-input" value="${esc(value)}" placeholder="值" /></td>
    <td><button class="delete-env-btn" type="button">✕</button></td>
  </tr>`;
}

function bindDeleteBtn(row) {
  row.querySelector(".delete-env-btn").addEventListener("click", () => {
    row.remove();
    updatePreview();
    updateCustomCount();
  });
}

function updateCustomCount() {
  const summary = document.querySelector("#advancedEnv summary");
  const rows = document.querySelectorAll("#envTableBody tr");
  if (summary) {
    summary.textContent = `自定义环境变量 (${rows.length})`;
  }
}

/** Build the full settings.json preview from current form state */
function buildPreviewJson(envOverride = null) {
  const env = envOverride || collectEnvFromForm();
  const preview = {
    env: env,
    enabledPlugins: {
      "rust-analyzer-lsp@claude-plugins-official": true,
    },
  };
  return JSON.stringify(preview, null, 2);
}

/** Collect all env values from the form (standard fields + custom table) */
function collectEnvFromForm() {
  const env = {};
  const standardKeys = ENV_FIELDS.map((f) => f.key);
  for (const key of standardKeys) {
    const input = document.getElementById(`env_${key}`);
    if (input && input.value.trim()) {
      env[key] = input.value.trim();
    }
  }
  // Custom env table
  const rows = document.querySelectorAll("#envTableBody tr");
  rows.forEach((row) => {
    const keyInput = row.querySelector(".env-key");
    const valueInput = row.querySelector(".env-value");
    if (keyInput && valueInput && keyInput.value.trim()) {
      env[keyInput.value.trim()] = valueInput.value;
    }
  });
  return env;
}

/** Live preview update handler */
function updatePreview() {
  const previewEl = document.getElementById("jsonPreview");
  if (!previewEl) return;
  const env = collectEnvFromForm();
  previewEl.textContent = buildPreviewJson(env);
}

async function saveProfile(editId) {
  const name = document.getElementById("editorName").value.trim();
  const provider = document.getElementById("editorProvider").value;

  if (!name) {
    show("error", "请输入方案名称");
    return;
  }

  // Collect all env fields
  const env = collectEnvFromForm();

  // Required fields check
  if (!env.ANTHROPIC_BASE_URL) {
    show("error", "ANTHROPIC_BASE_URL 为必填项");
    return;
  }
  if (!env.ANTHROPIC_MODEL) {
    show("error", "ANTHROPIC_MODEL 为必填项");
    return;
  }

  // Save env in profile for persistence and display
  const input = {
    name,
    provider,
    baseUrl: env.ANTHROPIC_BASE_URL,
    apiKey: env.ANTHROPIC_AUTH_TOKEN,
    model: env.ANTHROPIC_MODEL,
    timeout: 0,
    env,
  };

  let result;
  if (editId) {
    result = await api.updateProfile(editId, input);
  } else {
    // Check duplicate name
    const profiles = get("profiles");
    if (profiles.some((p) => p.name === name)) {
      show("error", "方案名称已存在");
      return;
    }
    result = await api.createProfile(input);
  }

  if (result.success) {
    show("success", editId ? "方案已更新" : "方案已创建");
    await loadProfiles();
    navigateTo("profiles");
    renderProfilesPage();
  } else {
    show("error", `保存失败: ${result.error?.message || "未知错误"}`);
  }
}

async function testConnection() {
  const baseUrl = document.getElementById("env_ANTHROPIC_BASE_URL")?.value.trim();
  const apiKey = document.getElementById("env_ANTHROPIC_AUTH_TOKEN")?.value.trim();
  const model = document.getElementById("env_ANTHROPIC_MODEL")?.value.trim();

  if (!baseUrl || !model) {
    show("error", "请先填写 Base URL 和 Model");
    return;
  }

  const resultDiv = document.getElementById("testResult");
  resultDiv.innerHTML = '<p style="color: var(--color-ink-muted);">测试中...</p>';

  try {
    const result = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (result.ok) {
      resultDiv.innerHTML = `<div class="test-result ok">✓ 连接成功 (HTTP ${result.status})</div>`;
    } else {
      const body = await result.text();
      resultDiv.innerHTML = `<div class="test-result fail">✗ HTTP ${result.status}: ${esc(body.slice(0, 200))}</div>`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    resultDiv.innerHTML = `<div class="test-result fail">✗ ${esc(msg)}</div>`;
  }
}

function addEnvRow(key = "", value = "") {
  const tbody = document.getElementById("envTableBody");
  const row = tbody.insertRow();
  row.innerHTML = `
    <td><input class="env-key" value="${esc(key)}" placeholder="变量名" /></td>
    <td><input class="env-value" value="${esc(value)}" placeholder="值" /></td>
    <td><button class="delete-env-btn">✕</button></td>
  `;
  row.querySelector(".delete-env-btn").addEventListener("click", () => row.remove());
}

// ========== Detail Page ==========

export function showDetailPage(profileId) {
  set("currentPage", "detail");
  set("detailProfileId", profileId);

  document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
  document.getElementById("page-detail").classList.add("active");

  const container = document.getElementById("detailContainer");
  const profile = get("profiles").find((p) => p.id === profileId);

  if (!profile) {
    container.innerHTML = '<div class="empty-state"><h3>未找到方案</h3></div>';
    return;
  }

  const settings = {
    env: {
      ANTHROPIC_AUTH_TOKEN: profile.encryptedApiKey ? "••••••••" : "(未设置)",
      ANTHROPIC_BASE_URL: profile.baseUrl,
      ANTHROPIC_MODEL: profile.model,
      ANTHROPIC_SMALL_FAST_MODEL: profile.model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: profile.model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: profile.model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: profile.model,
      CLAUDE_CODE_SUBAGENT_MODEL: profile.model,
    },
    enabledPlugins: {},
  };

  container.innerHTML = `
    <div class="detail-card">
      <div class="detail-hero">
        <h2>${getProviderEmoji(profile.provider)} ${esc(profile.name)}</h2>
        <div class="provider">${PROVIDER_NAME(profile.provider)}</div>
      </div>
      <div class="detail-sections">
        <div class="detail-section">
          <h3>API 地址</h3>
          <div class="value">${esc(profile.baseUrl)}</div>
        </div>
        <div class="detail-section">
          <h3>模型</h3>
          <div class="value">${esc(profile.model)}</div>
        </div>
        <div class="detail-section">
          <h3>超时</h3>
          <div class="value">${profile.timeout ? profile.timeout + "ms" : "默认"}</div>
        </div>
        <div class="detail-section">
          <h3>创建时间</h3>
          <div class="value">${formatDate(profile.createdAt)}</div>
        </div>
        <div class="detail-section">
          <h3>更新时间</h3>
          <div class="value">${formatDate(profile.updatedAt)}</div>
        </div>
        ${profile.notes ? `
        <div class="detail-section">
          <h3>备注</h3>
          <div class="value">${esc(profile.notes)}</div>
        </div>
        ` : ""}
        <div class="detail-section">
          <h3>settings.json 预览</h3>
          <pre>${esc(JSON.stringify(settings, null, 2))}</pre>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-primary pill" id="switchFromDetail" ${profile.isActive ? "disabled" : ""}>
          ${profile.isActive ? "✓ 当前激活" : "使用此方案"}
        </button>
        <button class="btn pill" id="editFromDetail">编辑</button>
        <button class="btn pill" id="backFromDetail">返回</button>
      </div>
    </div>
  `;

  document.getElementById("switchFromDetail").addEventListener("click", () => {
    handleSwitch(profileId);
  });

  document.getElementById("editFromDetail").addEventListener("click", () => {
    showEditorPage(profileId);
  });

  document.getElementById("backFromDetail").addEventListener("click", () => {
    navigateTo("profiles");
    renderProfilesPage();
  });
}

// ========== History Page ==========

export async function renderHistoryPage() {
  const container = document.getElementById("historyContainer");
  const entries = await api.listHistory();

  if (!entries || entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <h3>暂无操作历史</h3>
        <p>创建、编辑或切换方案后会显示在这里</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <h2 style="font-family: var(--font-display); font-weight: 600; font-size: var(--fs-display); letter-spacing: -0.28px; margin-bottom: var(--space-lg);">操作历史</h2>
    <div class="timeline">
      ${entries
        .reverse()
        .map(
          (e) => `
        <div class="timeline-item action-${e.action}">
          <div class="timeline-card">
            <div class="time">${formatDate(e.timestamp)}</div>
            <div class="action">${ACTION_LABEL(e.action)} ${e.profileName ? esc(e.profileName) : ""}</div>
            <div class="details">${esc(e.details)}</div>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function ACTION_LABEL(action) {
  const map = {
    create: "➕ 创建",
    update: "✏️ 编辑",
    delete: "🗑️ 删除",
    switch: "🔄 切换",
  };
  return map[action] || action;
}

// ========== Settings Page ==========

export async function renderSettingsPage() {
  const container = document.getElementById("settingsContainer");
  const version = await api.getVersion();
  const encAvail = await api.encryptionAvailable();
  const backups = await api.listBackups();
  const configDir = await api.getConfigDir();

  container.innerHTML = `
    <h2 style="font-family: var(--font-display); font-weight: 600; font-size: var(--fs-display); letter-spacing: -0.28px; margin-bottom: var(--space-lg);">设置</h2>

    <div class="settings-group">
      <h3>应用信息</h3>
      <div class="settings-row">
        <span class="label">版本</span>
        <span class="value">${version}</span>
      </div>
      <div class="settings-row">
        <span class="label">系统加密</span>
        <span class="value">${encAvail ? "可用" : "不可用"}</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>备份管理</h3>
      <div class="settings-row">
        <span class="label">备份数量</span>
        <span class="value">${backups.length} 份</span>
      </div>
      ${backups.length > 0 ? `
        <div class="settings-row">
          <span class="label">最新备份</span>
          <span class="value">${formatDate(backups[0].timestamp)}</span>
        </div>
      ` : ""}
      <div class="settings-row">
        <span class="label">操作</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm pill" id="createBackupBtn">创建备份</button>
          ${backups.length > 0 ? `<button class="btn btn-sm pill" id="restoreLatestBtn">恢复最新</button>` : ""}
        </div>
      </div>
    </div>

    <div class="settings-group">
      <h3>数据文件</h3>
      <div class="settings-row">
        <span class="label">配置目录</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="value" id="configDirPath">${esc(configDir) || "—"}</span>
          <button class="btn btn-sm pill" id="changeConfigDirBtn">重新选择</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("createBackupBtn")?.addEventListener("click", async () => {
    const result = await api.createBackup();
    if (result) {
      show("success", "备份已创建");
      renderSettingsPage();
    } else {
      show("error", "备份创建失败");
    }
  });

  document.getElementById("restoreLatestBtn")?.addEventListener("click", async () => {
    if (confirm("确认恢复最新备份？当前配置将被覆盖。")) {
      const result = await api.restoreBackup(backups[0].id);
      if (result) {
        show("success", "已恢复最新备份");
      } else {
        show("error", "恢复失败");
      }
    }
  });

  document.getElementById("changeConfigDirBtn")?.addEventListener("click", async () => {
    const result = await api.selectConfigDir();
    if (result && !result.canceled && result.filePaths.length > 0) {
      const dir = result.filePaths[0];
      await api.setConfigDir(dir);
      show("success", "配置目录已更新，已重新加载配置");
      renderSettingsPage();
      await loadProfiles();
    }
  });
}

// ========== Utility ==========

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
