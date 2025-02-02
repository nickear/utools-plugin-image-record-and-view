<script setup lang="ts">
import SvgIcon from '@/component/svgIcon/index.vue'
import {onMounted, ref} from "vue";

const props = defineProps(['clientX', 'clientY', 'menuList'])
const emit = defineEmits(['afterClick'])
const contextMenuRef = ref()
const left = ref<number>(0)
const top = ref<number>(0)

onMounted(() => {
    const {width: menuWidth, height: menuHeight} = contextMenuRef.value.getBoundingClientRect()
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    if (props.clientX + menuWidth > windowWidth) {
        left.value = windowWidth - menuWidth
    } else {
        left.value = props.clientX
    }
    if (props.clientY + menuHeight > windowHeight) {
        top.value = windowHeight - menuHeight
    } else {
        top.value = props.clientY
    }
})
</script>

<template>
    <div ref="contextMenuRef" class="menu-container" :style="{ left: left + 'px', top: top + 'px' }">
        <div v-for="menuItem in menuList" :key="menuItem.name" class="menu-item" @click="() => {
            menuItem.clickFn()
            emit('afterClick')
        }" :title="menuItem.title">
            <SvgIcon :name="menuItem.icon" :icon-style="{marginRight: '4px'}"></SvgIcon>
            {{ menuItem.name }}
        </div>
    </div>
</template>

<style scoped>
.menu-container {
    position: fixed;
    z-index: 1000;
    background-color: #fff;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
    padding: 10px 0;
}

.menu-item {
    display: flex;
    height: 30px;
    align-items: center;
    cursor: pointer;
    padding: 0 10px;
}

.menu-item:hover {
    background-color: #f5f5f5;
}
</style>