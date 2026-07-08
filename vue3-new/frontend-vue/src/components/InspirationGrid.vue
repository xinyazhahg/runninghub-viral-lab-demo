<script setup>
const items = [
  {
    title: '41岁的C罗连进2个球',
    coverUrl: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=720&q=80',
    duration: '00:18',
    ratio: '9:16',
    size: '48.6MB',
  },
  {
    title: '我的高考出分时刻',
    coverUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=720&q=80',
    duration: '00:16',
    ratio: '9:16',
    size: '42.8MB',
  },
  {
    title: '我把旅行做成票根',
    coverUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=720&q=80',
    duration: '00:20',
    ratio: '9:16',
    size: '51.2MB',
  },
  {
    title: '内马尔首秀',
    coverUrl: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=720&q=80',
    duration: '00:15',
    ratio: '9:16',
    size: '39.4MB',
  },
  {
    title: '爱的主打歌',
    coverUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=720&q=80',
    duration: '00:18',
    ratio: '9:16',
    size: '44.1MB',
  },
  {
    title: '跨次元的宿命感',
    coverUrl: 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=720&q=80',
    duration: '00:22',
    ratio: '9:16',
    size: '56.7MB',
  },
]
</script>

<template>
  <section class="inspiration">
    <div class="module-label">
      <span class="module-dot"></span>
      <strong>热门视频灵感</strong>
      <span>仅作参考</span>
    </div>

    <div class="inspiration-grid">
      <article
        v-for="(item, i) in items"
        :key="i"
        class="inspiration-card"
        tabindex="0"
      >
        <div class="inspiration-cover">
          <img :src="item.coverUrl" :alt="item.title" loading="lazy" />
        </div>
        <div class="inspiration-meta">
          <strong>{{ item.title }}</strong>
          <span>{{ item.duration }} · {{ item.ratio }} · {{ item.size }}</span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.inspiration {
  min-width: 0;
  margin-top: 38px;
}

.module-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: #b7bbc2;
  font-size: 15px;
}

.module-label > span:last-child {
  color: #797d85;
  font-size: 12px;
}

.module-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 14px rgba(53, 245, 154, 0.8);
  opacity: 0.75;
}

.inspiration-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.inspiration-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(24, 25, 26, 0.94);
  cursor: pointer;
  transition: border-color 0.18s ease, filter 0.18s ease, transform 0.18s ease;
}

.inspiration-cover {
  position: relative;
  aspect-ratio: 9 / 12.5;
  overflow: hidden;
  background: #1c1c1c;
  filter: saturate(0.82) brightness(0.78);
}

.inspiration-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.42s ease, filter 0.18s ease;
}

.inspiration-cover::after {
  content: "";
  position: absolute;
  z-index: 2;
  inset: 0;
  background: linear-gradient(180deg, transparent 46%, rgba(0, 0, 0, 0.58));
  pointer-events: none;
}

.inspiration-card:hover {
  border-color: rgba(53, 245, 154, 0.24);
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.inspiration-card:hover .inspiration-cover {
  filter: saturate(0.95) brightness(0.9);
}

.inspiration-card:hover .inspiration-cover img {
  transform: scale(1.06);
  filter: brightness(1.04);
}

.inspiration-meta {
  display: grid;
  gap: 4px;
  padding: 11px;
}

.inspiration-meta strong {
  font-size: 14px;
  line-height: 1.25;
  overflow-wrap: anywhere;
  color: #f0f0f0;
}

.inspiration-meta span {
  color: #82868d;
  font-size: 12px;
}
</style>
