<template>
  <div class="welcome">
    <h1>📖 随心记</h1>
    <p>网文写手的第二大脑</p>
    <p class="welcome-hint">选择左侧作品，或新建一个开始</p>
  </div>
</template>

<style scoped>
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}
.welcome h1 {
  font-size: 48px;
  color: var(--text-primary);
  margin-bottom: 12px;
  font-weight: 700;
}
.welcome p {
  font-size: 16px;
}
.welcome-hint {
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-muted);
}
</style>
