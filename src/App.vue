<script setup lang="ts">
import {ref} from "vue";
import ImageRecordAndView from '@/component/imageRecordAndView/index.vue'
import Setting from '@/component/setting/index.vue'
import {ElMessageBox} from "element-plus";

const pluginCode = ref<string>('')
utools.onPluginEnter(({code}) => {
    const imagesDir = utools.db.get('images-dir')?.value
    window.p.setImagesDir(imagesDir || '')
    if (!imagesDir) {
        pluginCode.value = 'setting'
    } else if (!window.p.isImagesDirExist()) {
        pluginCode.value = 'setting'
        ElMessageBox.alert(`文件夹「${imagesDir}」不存在，请重新设置`, '提示', {
            showClose: false,
            confirmButtonText: '确定'
        })
    } else {
        pluginCode.value = code
    }
})
utools.onPluginOut(() => {
    ElMessageBox.close()
    pluginCode.value = ''
})

</script>

<template>
    <Setting v-if="pluginCode === 'setting'" @back="pluginCode = 'imageRecordAndView'"></Setting>
    <ImageRecordAndView v-else-if="pluginCode" :plugin-code="pluginCode" @setting="pluginCode = 'setting'"></ImageRecordAndView>
</template>

<style scoped>

</style>