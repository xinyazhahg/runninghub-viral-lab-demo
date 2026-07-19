<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  highlightTerms: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  expanded: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'focus'])
const editor = ref(null)
const focused = ref(false)

function normalizedTerms() {
  return [...new Set(props.highlightTerms.map((item) => String(item || '').trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length)
}

function renderHighlightedText() {
  const element = editor.value
  if (!element || focused.value) return
  const text = String(props.modelValue || '')
  const terms = normalizedTerms()
  element.replaceChildren()
  if (!terms.length) {
    element.append(document.createTextNode(text))
    return
  }
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const matcher = new RegExp(`(${escaped.join('|')})`, 'g')
  for (const part of text.split(matcher)) {
    if (!part) continue
    if (terms.includes(part)) {
      const mark = document.createElement('span')
      mark.className = 'replacement-highlight'
      mark.textContent = part
      element.append(mark)
    } else {
      element.append(document.createTextNode(part))
    }
  }
}

function handleInput() {
  emit('update:modelValue', editor.value?.innerText || '')
}

function handleFocus() {
  focused.value = true
  emit('focus')
}

function handleBlur() {
  focused.value = false
  nextTick(renderHighlightedText)
}

watch(() => [props.modelValue, ...props.highlightTerms], () => nextTick(renderHighlightedText))
onMounted(renderHighlightedText)
</script>

<template>
  <div
    ref="editor"
    class="prompt-editor"
    :class="{ disabled, 'is-collapsed': !expanded }"
    :contenteditable="disabled ? 'false' : 'true'"
    role="textbox"
    aria-multiline="true"
    spellcheck="false"
    @input="handleInput"
    @focus="handleFocus"
    @blur="handleBlur"
  ></div>
</template>

<style scoped>
.prompt-editor {
  width: 100%;
  min-height: 260px;
  max-height: 520px;
  overflow: auto;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 10px;
  outline: none;
  color: #e9efec;
  background: #0b0e0d;
  font: inherit;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.prompt-editor.is-collapsed {
  min-height: 176px;
  max-height: 176px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
}
.prompt-editor:focus { border-color: #8ec8ff; box-shadow: 0 0 0 1px #8ec8ff; }
.prompt-editor.is-collapsed:focus {
  min-height: 260px;
  max-height: 520px;
  overflow: auto;
  -webkit-mask-image: none;
  mask-image: none;
}
.prompt-editor.disabled { opacity: .72; cursor: not-allowed; }
:deep(.replacement-highlight) { color: var(--green); font-weight: 800; }
</style>
