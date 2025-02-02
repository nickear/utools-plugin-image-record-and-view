<script setup lang="ts">
import {ref} from "vue";
import {ElMessage} from "element-plus";

const emit = defineEmits(['back'])
const imagesDir = ref<string>(window.p.getImagesDir())
const handleBtnClick = () => {
    const files = utools.showOpenDialog({
        properties: ['openDirectory']
    })
    if (files && files.length) {
        if (files[0] === imagesDir.value) {
            ElMessage.success({
                message: '设置成功',
                showClose: true
            })
            return
        }
        utools.db.remove('images-dir')
        const res = utools.db.put({
            _id: 'images-dir',
            value: files[0]
        })
        if (res.ok) {
            imagesDir.value = files[0]
            window.p.setImagesDir(files[0])
            ElMessage.success({
                message: '设置成功',
                showClose: true
            })
        } else {
            ElMessage.error({
                message: res.message || '设置失败',
                showClose: true
            })
        }
    }
}

</script>

<template>
    <div>
        <el-button style="margin-left: 10px; color: white" v-if="imagesDir"
                   color="#597ef7" @click="emit('back')">返回
        </el-button>
        <div class="main-container">
            <h3 class="title">
                设置存放图片的文件夹
            </h3>
            <el-input :value="imagesDir" readonly>
                <template #append>
                    <el-button style="background-color: #597ef7; color: white" @click="handleBtnClick">选择文件夹
                    </el-button>
                </template>
            </el-input>
        </div>
    </div>
</template>

<style scoped>
.main-container {
    width: 70%;
    margin: 30px auto 0 auto;
}

.title {
    color: #597ef7;
    line-height: 1.5;
}

</style>