<script setup lang="ts">
import {ref, watchEffect, onMounted, onUnmounted, computed, nextTick} from 'vue'
import {ElMessage, ElMessageBox} from "element-plus";
import ContextMenu from '@/component/contextMenu/index.vue'
import draggable from 'vuedraggable'
import {ElMessageBoxOptions} from "element-plus/es/components/message-box/src/message-box.type";
import SvgIcon from '@/component/svgIcon/index.vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const props = defineProps(['pluginCode'])
const emit = defineEmits(['setting'])

const groupList = ref<string[]>([])
const groupDialogVisible = ref<boolean>(false)
const groupName = ref<string>('')
const groupInputRef = ref()
const groupIndex = ref<number>(-1)
const isGroupAdd = ref<boolean>(true)
const tipsVisible = ref<boolean>(false)
const search = ref<string>('')
const showSidebar = ref<boolean>(true)
const openedGroup = ref<string>('') // 当前打开的分组
const contextMenuVisible = ref<boolean>(false)
const clientX = ref<number>(0)
const clientY = ref<number>(0)
const menuList = ref<{ icon: string, name: string, clickFn: () => void }[]>([])
const imageList = ref<string[]>([])
const fullscreenVisible = ref<boolean>(false)
const fullscreenImage = ref<string>('')
const featureCodes = ref<string[]>([])
const imageName = ref<string>('')
const imageInputRef = ref()
const imageExtension = ref<string>('')
const imageIndex = ref<number>(-1)
const imageDialogVisible = ref<boolean>(false)
const batchDialogVisible = ref<boolean>(false)
const loading = ref<boolean>(false)
const globalLayoutDialogVisible = ref<boolean>(false)
const globalImageNumPerRow = ref<number>(1)
const globalImageNumPerRowTemp = ref<number>(1)
const groupLayoutDialogVisible = ref<boolean>(false)
const groupImageNumPerRow = ref<number>(0)
const groupImageNumPerRowTemp = ref<number>(0)
const selectedImages = ref<string[]>([])
const batchEditImages = ref<{id: string, originalName: string, name: string, extension: string, tipsVisible: boolean}[]>([])
const imageBatchEditDialogVisible = ref<boolean>(false)
const isUploading = ref<boolean>(false) // 防止重复上传
const allSelected = ref<boolean>(false) // 全选状态

// 懒加载相关
let imageObserver: IntersectionObserver | null = null // 图片懒加载观察器

const supportImageMIME = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/bmp', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']

const imageNumPerRow = computed(() => {
    return groupImageNumPerRow.value || globalImageNumPerRow.value || 1
})

// 过滤后的图片列表（支持搜索）
const filteredImageList = computed(() => {
    if (!search.value || !search.value.trim()) {
        return imageList.value
    }
    const searchText = search.value.trim().toLowerCase()
    return imageList.value.filter((image: string) => 
        image.toLowerCase().includes(searchText)
    )
})

// 虚拟列表使用的数据（需要对象格式）
const virtualListItems = computed(() => {
    return filteredImageList.value.map((image: string) => ({
        id: image,
        name: image
    }))
})

// 监听搜索结果变化，重新观察图片元素
watchEffect(() => {
    // 访问 filteredImageList 以建立依赖
    if (filteredImageList.value.length > 0) {
        // 搜索结果变化后，重新观察图片
        observeImages()
    }
})

// 监听搜索条件变化，更新全选状态
watchEffect(() => {
    // 当搜索条件改变时，检查并更新全选状态
    if (filteredImageList.value.length > 0) {
        updateAllSelectedState()
    } else {
        allSelected.value = false
    }
})

// 初始化图片懒加载观察器
const initImageObserver = () => {
    if (imageObserver) return
    
    imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target as HTMLImageElement
                const src = img.dataset.src
                
                // 如果有 data-src 且还没加载，则加载图片
                if (src && !img.src.endsWith(src)) {
                    img.src = src
                    // 加载后停止观察这个元素
                    imageObserver!.unobserve(img)
                }
            }
        })
    }, {
        root: null,  // 使用视口作为根元素
        rootMargin: '200px',  // 提前200px开始加载
        threshold: 0.01  // 元素1%可见时触发
    })
}

// 观察所有懒加载图片
const observeImages = () => {
    if (!imageObserver) {
        initImageObserver()
    }
    
    // 等待 DOM 更新后观察新元素
    nextTick(() => {
        const images = document.querySelectorAll('.lazy-image')
        images.forEach(img => {
            imageObserver!.observe(img)
        })
    })
}

const handleGroupDialogConfirmBtnClick = () => {
    groupName.value = groupName.value.trim()

    // 使用后端验证函数检查分组名称合法性
    const validation = window.p.validateFileName(groupName.value)
    if (!validation.valid) {
        ElMessage.warning({
            message: `操作失败，${validation.error}`,
            showClose: true
        })
        return
    }

    // 检查名称是否重复（排除当前分组自身）
    const existingIndex = groupList.value.indexOf(groupName.value)
    if (existingIndex !== -1 && (isGroupAdd.value || existingIndex !== groupIndex.value)) {
        ElMessage.warning({
            message: '操作失败，分组名称重复',
            showClose: true
        })
        return
    }

    if (isGroupAdd.value) {
        // 新建分组
        const result = window.p.createNewGroup(groupName.value)
        if (!result.success) {
            ElMessage.warning({
                message: `创建失败，${result.error}`,
                showClose: true
            })
            return
        }
        groupList.value.push(groupName.value)
        handleGroupChange(groupName.value, true)
        ElMessage.success({
            message: '创建成功',
            showClose: true
        })
    } else {
        // 重命名分组
        const originalGroup = groupList.value[groupIndex.value]

        // 如果名称没有变化，直接关闭对话框
        if (originalGroup === groupName.value) {
            groupDialogVisible.value = false
            return
        }

        const result = window.p.renameGroup(originalGroup, groupName.value)
        if (!result.success) {
            ElMessage.warning({
                message: `重命名失败，${result.error}`,
                showClose: true
            })
            return
        }

        // 更新关键字
        featureCodes.value.forEach((featureCode: string, index: number) => {
            if (featureCode.startsWith(`${originalGroup}/`)) {
                utools.removeFeature(featureCode)
                const image = featureCode.slice(featureCode.indexOf('/') + 1)
                const newFeatureCode = `${groupName.value}/${image}`
                utools.setFeature({
                    code: newFeatureCode,
                    explain: image,
                    platform: ['win32', 'darwin', 'linux'],
                    cmds: [image]
                })
                featureCodes.value[index] = newFeatureCode
            }
        })

        // 更新当前打开的分组
        if (openedGroup.value === originalGroup) {
            openedGroup.value = groupName.value
        }

        groupList.value[groupIndex.value] = groupName.value
        saveGroupProfile()
        ElMessage.success({
            message: '重命名成功',
            showClose: true
        })
    }
    groupDialogVisible.value = false
}

const handleGroupChange = async (group: string, isNewGroup?: boolean) => {
    imageList.value = []
    openedGroup.value = group
    
    // 清空选中状态
    selectedImages.value = []
    allSelected.value = false
    
    if (isNewGroup) {
        groupImageNumPerRow.value = 0
    } else {
        loading.value = true
        const {list, profile} = await window.p.getImageListAndProfile(group)
        loading.value = false
        imageList.value = list
        groupImageNumPerRow.value = profile.imageNumPerRow || 0
        
        // 观察新的图片元素（懒加载）
        observeImages()
    }
    saveGroupProfile()
}

const saveImageHandler = async (saveImageFn: (listItem?: any) => Promise<string>, list?: any[]) => {
    // 防止重复调用
    if (isUploading.value) {
        ElMessage.warning({
            message: '正在上传中，请稍候',
            showClose: true
        })
        return
    }
    
    isUploading.value = true
    loading.value = true
    
    try {
        if (list) {
            const CONCURRENT_LIMIT = 5  // 每批并发5个
            const results: (string | null)[] = new Array(list.length).fill(null)
            let successCount = 0
            
            // 倒序分批处理（保持原有逻辑）
            for (let i = list.length - 1; i >= 0; i -= CONCURRENT_LIMIT) {
                const start = Math.max(0, i - CONCURRENT_LIMIT + 1)
                const end = i + 1
                const batch = list.slice(start, end)
                
                // 并发上传这一批，但记录每个文件的原始索引
                const batchPromises = batch.map((item, batchIdx) => 
                    saveImageFn(item).then(result => ({
                        originalIndex: start + batchIdx,
                        result
                    }))
                )
                
                const batchResults = await Promise.allSettled(batchPromises)
                
                // 按原始索引存储结果
                batchResults.forEach(promiseResult => {
                    if (promiseResult.status === 'fulfilled' && promiseResult.value.result) {
                        results[promiseResult.value.originalIndex] = promiseResult.value.result
                        successCount++
                    }
                })
            }
            
            // 一次性更新 UI（保持顺序：倒序插入）
            const successImages = results.filter(r => r !== null).reverse()
            imageList.value = [...successImages, ...imageList.value]
            
            loading.value = false
            
            if (successCount === 0) {
                ElMessage.warning({
                    message: '上传失败',
                    showClose: true
                })
                return
            }
            if (successCount === list.length) {
                ElMessage.success({
                    message: '上传成功，若图片未显示，请等待其加载',
                    showClose: true
                })
            } else {
                ElMessage.info({
                    message: `上传成功数量${successCount}，失败数量${list.length - successCount}张，若上传成功的图片未显示，请等待其加载`,
                    showClose: true,
                })
            }
        } else {
            const image = await saveImageFn()
            loading.value = false
            if (!image) {
                ElMessage.warning({
                    message: '上传失败',
                    showClose: true
                })
                return
            }
            imageList.value.unshift(image)
            ElMessage.success({
                message: '上传成功，若图片未显示，请等待其加载',
                showClose: true
            })
        }

        document.querySelector('.image-list')?.scrollTo(0, 0)
        saveImageProfile()
        
        // 观察新上传的图片（懒加载）
        observeImages()
    } finally {
        loading.value = false
        isUploading.value = false
    }
}

const handleUploadBtnClick = () => {
    const files = utools.showOpenDialog({
        filters: [{name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp', 'ico']}],
        properties: ['openFile', 'multiSelections'] as any,
        title: '选择一张或多张图片'
    })
    if (files && files.length) {
        saveImageHandler((path) => window.p.copyImage(path, openedGroup.value), files)
    }
}

const handleScreenshotBtnClick = () => {
    utools.screenCapture(((imgBase64: string) => {
        saveImageHandler(() => window.p.saveBase64Image(openedGroup.value, imgBase64))
    }))
}

const convertMIMEToExtension = (MIME: string) => {
    if (MIME === 'image/x-icon' || MIME === 'image/vnd.microsoft.icon') {
        return '.ico'
    }
    if (MIME === 'image/svg+xml') {
        return '.svg'
    }
    if (MIME === 'image/jpeg') {
        return '.jpg'
    }
    return '.' + MIME.slice(6)
}

const handleClipboardBtnClick = () => {
    const copyFiles = utools.getCopyedFiles()
    if (copyFiles) {
        // 如果复制的是图片文件（可以多张）
        const supportImages = copyFiles.filter(({isFile, name}) => isFile && window.p.isSupportImage(name))
        if (supportImages.length === 0) {
            ElMessage.warning({
                message: '上传失败，剪贴板中未读取到图片，或图片格式不支持',
                showClose: true
            })
        } else {
            saveImageHandler(({path}) => window.p.copyImage(path, openedGroup.value), supportImages)
        }
    } else {
        // 如果复制的是纯图片（只能一张）
        navigator.clipboard.read().then(async (clipboards) => {
            // 剪贴板通常只有一个 ClipboardItem
            if (clipboards.length === 0) {
                ElMessage.warning({
                    message: '上传失败，剪贴板中未读取到图片',
                    showClose: true
                })
                return
            }
            
            // 只处理第一个 ClipboardItem
            const clipboard = clipboards[0]
            const imageType = clipboard.types.find(type => supportImageMIME.includes(type))
            
            if (!imageType) {
                ElMessage.warning({
                    message: '上传失败，剪贴板中未读取到图片，或图片格式不支持',
                    showClose: true
                })
                return
            }
            
            try {
                const blob = await clipboard.getType(imageType)
                const arrayBuffer = await blob.arrayBuffer()
                
                // 单张图片上传
                saveImageHandler(
                    () => window.p.savePureImage(
                        openedGroup.value, 
                        arrayBuffer, 
                        convertMIMEToExtension(imageType)
                    )
                )
            } catch (e) {
                ElMessage.warning({
                    message: '上传失败，请重新复制',
                    showClose: true
                })
            }
        }).catch(e => {
            ElMessage.warning({
                message: '上传失败，请重新复制',
                showClose: true
            })
        })
    }
}

const handleBatchBtnClick = () => {
    batchDialogVisible.value = true
}

// 虚拟列表选中逻辑
const toggleImageSelection = (image: string) => {
    const index = selectedImages.value.indexOf(image)
    if (index > -1) {
        selectedImages.value.splice(index, 1)
    } else {
        selectedImages.value.push(image)
    }
    updateAllSelectedState()
}

const isImageSelected = (image: string) => {
    return selectedImages.value.includes(image)
}

const toggleAllSelection = () => {
    if (allSelected.value) {
        selectedImages.value = []
        allSelected.value = false
    } else {
        selectedImages.value = [...filteredImageList.value]
        allSelected.value = true
    }
}

const updateAllSelectedState = () => {
    if (filteredImageList.value.length === 0) {
        allSelected.value = false
        return
    }
    
    // 检查 filteredImageList 中的所有图片是否都被选中
    const allFilteredSelected = filteredImageList.value.every(image => 
        selectedImages.value.includes(image)
    )
    allSelected.value = allFilteredSelected
}

const handleGroupLayoutBtnClick = () => {
    groupImageNumPerRowTemp.value = groupImageNumPerRow.value
    groupLayoutDialogVisible.value = true
}

const handleImageEditBtnClick = (image: string, index: number) => {
    imageName.value = image.slice(0, image.lastIndexOf('.'))
    imageExtension.value = image.slice(image.lastIndexOf('.'))
    imageIndex.value = index
    imageDialogVisible.value = true
}

const batchExecuteSync = (list: any[], executeEach: (item: any, index?: number) => boolean, batchSize: number = 10): Promise<number> => {
    return new Promise((resolve) => {
        let successCount = 0
        let index = 0

        function processBatch() {
            const end = Math.min(index + batchSize, list.length)
            for (let i = index; i < end; i++) {
                const result = executeEach(list[i], i)
                if (result) {
                    successCount++
                }
            }
            index = end
            if (index < list.length) {
                setTimeout(processBatch, 0)
            } else {
                resolve(successCount)
            }
        }

        processBatch()
    })
}

const batchExecuteAsync = async (list: any[], executeEach: (item: any, index?: number) => Promise<boolean>) => {
    let successCount = 0
    for (let i = 0;  i < list.length; i++) {
        if (await executeEach(list[i], i)) {
            successCount++
        }
    }
    return successCount
}

const batchOperateHandler = async (
    batchOperateFn: (image?: string, index?: number) => boolean | Promise<boolean>,
    {allInOne, showMessage = true}: {allInOne: boolean, showMessage?: boolean}) => {
    if (selectedImages.value.length === 0) {
        ElMessage.warning({
            message: '未选中图片',
            showClose: true
        })
        return
    }
    if (allInOne) {
        let success: boolean
        if (batchOperateFn.constructor.name === 'AsyncFunction') {
            loading.value = true
            success = await (batchOperateFn() as Promise<boolean>)
            loading.value = false
        } else {
            success = batchOperateFn() as boolean
        }
        if (showMessage) {
            ElMessage({
                type: success ? 'success' : 'warning',
                message: success ? '操作成功' : '操作失败',
                showClose: true
            })
        }
    } else {
        loading.value = true
        let successCount: number
        const targetCount = selectedImages.value.length
        if (batchOperateFn.constructor.name === 'AsyncFunction') {
            successCount = await batchExecuteAsync(selectedImages.value, batchOperateFn as (item: any, index?: number) => Promise<boolean>)
        } else {
            successCount = await batchExecuteSync(selectedImages.value, batchOperateFn as (item: any, index?: number) => boolean)
        }
        loading.value = false
        if (showMessage) {
            if (successCount === 0) {
                ElMessage.warning({
                    message: '操作失败',
                    showClose: true
                })
            } else if (successCount === targetCount) {
                ElMessage.success({
                    message: '操作成功',
                    showClose: true
                })
            } else {
                ElMessage.info({
                    message: `操作成功数量${successCount}，失败数量${targetCount - successCount}`,
                    showClose: true
                })
            }
        }
    }
}

const handleImageBatchEditBtnClick = () => {
    if (selectedImages.value.length === 0) {
        ElMessage.warning({
            message: '未选中图片',
            showClose: true
        })
    } else {
        batchEditImages.value = selectedImages.value.map((image: string, index: number) => ({
            id: `${image}_${index}`, // 添加唯一 id
            originalName: image, // 保存原始完整名称
            name: image.slice(0, image.lastIndexOf('.')),
            extension: image.slice(image.lastIndexOf('.')),
            tipsVisible: false
        }))
        imageBatchEditDialogVisible.value = true
    }
}

const handleImageCopyBtnClick = (image: string) => {
    const imagePath = getImagePath(image)
    if (utools.copyImage(imagePath) || utools.copyFile(imagePath)) {
        ElMessage.success({
            message: '复制成功',
            showClose: true
        })
    } else {
        ElMessage.warning({
            message: '复制失败',
            showClose: true
        })
    }
}

const handleImageFileCopyBtnClick = (image: string) => {
    if (utools.copyFile(getImagePath(image))) {
        ElMessage.success({
            message: '复制成功',
            showClose: true
        })
    } else {
        ElMessage.warning({
            message: '复制失败',
            showClose: true
        })
    }
}

const handleImageFileBatchCopyBtnClick = () => {
    if (selectedImages.value.length === 0) {
        ElMessage.warning({
            message: '未选中图片',
            showClose: true
        })
        return
    }

    // 构建文件路径列表
    const filePaths = selectedImages.value.map((image: string) => getImagePath(image))

    // utools.copyFile 支持传入数组，一次性复制多个文件到剪贴板
    const success = utools.copyFile(filePaths)

    if (success) {
        ElMessage.success({
            message: '复制成功',
            showClose: true
        })
    } else {
        ElMessage.warning({
            message: '复制失败',
            showClose: true
        })
    }
}

const handleImagePasteBtnClick = (image: string) => {
    const imagePath = getImagePath(image)
    if (!utools.hideMainWindowPasteImage(imagePath)) {
        utools.hideMainWindowPasteFile(imagePath)
    }
}

const handleImageFilePasteBtnClick = (image: string) => {
    utools.hideMainWindowPasteFile(getImagePath(image))
}

const handleImageFileBatchPasteBtnClick = () => {
    if (selectedImages.value.length === 0) {
        ElMessage.warning({
            message: '未选中图片',
            showClose: true
        })
        return
    }

    // 构建文件路径列表
    const filePaths = selectedImages.value.map((image: string) => getImagePath(image))

    // utools.hideMainWindowPasteFile 支持传入数组，一次性粘贴多个文件
    utools.hideMainWindowPasteFile(filePaths)
}

const handleKeywordBatchSetBtnClick = async () => {
    if (selectedImages.value.length === 0) {
        ElMessage.warning({
            message: '未选中图片',
            showClose: true
        })
        return
    }

    loading.value = true

    // 收集需要设置的关键字
    const toSet: string[] = []
    let alreadySetCount = 0

    for (const image of selectedImages.value) {
        const featureCode = `${openedGroup.value}/${image}`
        if (featureCodes.value.includes(featureCode)) {
            alreadySetCount++
        } else {
            toSet.push(image)
        }
    }

    // 分批设置，避免阻塞主线程
    const successCodes: string[] = []
    const BATCH_SIZE = 50

    for (let i = 0; i < toSet.length; i += BATCH_SIZE) {
        const batch = toSet.slice(i, i + BATCH_SIZE)

        for (const image of batch) {
            const featureCode = `${openedGroup.value}/${image}`
            if (
                utools.setFeature({
                    code: featureCode,
                    explain: image,
                    platform: ['win32', 'darwin', 'linux'],
                    cmds: [image]
                })
            ) {
                successCodes.push(featureCode)
            }
        }

        // 让出主线程，避免卡顿
        if (i + BATCH_SIZE < toSet.length) {
            await new Promise(resolve => setTimeout(resolve, 0))
        }
    }

    // 一次性更新响应式数据
    if (successCodes.length > 0) {
        featureCodes.value = [...featureCodes.value, ...successCodes]
    }

    loading.value = false

    // 显示结果
    const successCount = successCodes.length + alreadySetCount
    const totalCount = selectedImages.value.length
    if (successCount === totalCount) {
        ElMessage.success({
            message: '操作成功',
            showClose: true
        })
    } else if (successCount === 0) {
        ElMessage.warning({
            message: '操作失败',
            showClose: true
        })
    } else {
        ElMessage.info({
            message: `操作成功数量${successCount}，失败数量${totalCount - successCount}`,
            showClose: true
        })
    }
}

const handleKeywordBatchRemoveBtnClick = async () => {
    if (selectedImages.value.length === 0) {
        ElMessage.warning({
            message: '未选中图片',
            showClose: true
        })
        return
    }

    loading.value = true

    // 收集需要移除的关键字
    const toRemove: string[] = []
    let notSetCount = 0

    for (const image of selectedImages.value) {
        const featureCode = `${openedGroup.value}/${image}`
        if (featureCodes.value.includes(featureCode)) {
            toRemove.push(featureCode)
        } else {
            notSetCount++
        }
    }

    // 分批移除，避免阻塞主线程
    const removedCodes = new Set<string>()
    const BATCH_SIZE = 50

    for (let i = 0; i < toRemove.length; i += BATCH_SIZE) {
        const batch = toRemove.slice(i, i + BATCH_SIZE)

        for (const featureCode of batch) {
            if (utools.removeFeature(featureCode)) {
                removedCodes.add(featureCode)
            }
        }

        // 让出主线程，避免卡顿
        if (i + BATCH_SIZE < toRemove.length) {
            await new Promise(resolve => setTimeout(resolve, 0))
        }
    }

    // 一次性更新响应式数据
    if (removedCodes.size > 0) {
        featureCodes.value = featureCodes.value.filter(
            code => !removedCodes.has(code)
        )
    }

    loading.value = false

    // 显示结果
    const successCount = removedCodes.size + notSetCount
    const totalCount = selectedImages.value.length
    if (successCount === totalCount) {
        ElMessage.success({
            message: '操作成功',
            showClose: true
        })
    } else if (successCount === 0) {
        ElMessage.warning({
            message: '操作失败',
            showClose: true
        })
    } else {
        ElMessage.info({
            message: `操作成功数量${successCount}，失败数量${totalCount - successCount}`,
            showClose: true
        })
    }
}

const handleImageFullscreenBtnClick = (image: string) => {
    fullscreenImage.value = image
    fullscreenVisible.value = true
}

const handleImageOpenBtnClick = (image: string) => {
    utools.shellOpenPath(getImagePath(image))
}

const handleImageRemoveBtnClick = (image: string, index: number) => {
    ElMessageBox.confirm(
        `确定删除图片「${image}」？图片删除后将无法恢复！！！`,
        '提示',
        {
            confirmButtonText: '确定删除',
            confirmButtonClass: 'el-button--danger',
            cancelButtonText: '取消',
            type: 'warning',
        } as ElMessageBoxOptions
    )
        .then(async () => {
            loading.value = true
            const success = await window.p.removeImage(openedGroup.value, image)
            loading.value = false
            if (!success) {
                ElMessage.warning({
                    message: '删除失败',
                    showClose: true
                })
                return
            }
            ElMessage.success({
                message: '删除成功',
                showClose: true
            })
            const featureCode = `${openedGroup.value}/${image}`
            if (featureCodes.value.includes(featureCode)) {
                removeKeyword(featureCode, image)
            }
            imageList.value.splice(index, 1)
            
            // 清理选中状态
            const selectedIndex = selectedImages.value.indexOf(image)
            if (selectedIndex > -1) {
                selectedImages.value.splice(selectedIndex, 1)
                updateAllSelectedState()
            }
            
            saveImageProfile()
        })
}

const handleImageBatchRemoveBtnClick = () => {
    if (selectedImages.value.length === 0) {
        ElMessage.warning({
            message: '未选中图片',
            showClose: true
        })
        return
    }

    ElMessageBox.confirm(
        `确定删除选中的 ${selectedImages.value.length} 张图片？图片删除后将无法恢复！！！`,
        '提示',
        {
            confirmButtonText: '确定删除',
            confirmButtonClass: 'el-button--danger',
            cancelButtonText: '取消',
            type: 'warning'
        } as ElMessageBoxOptions
    ).then(async () => {
        loading.value = true

        // 收集要删除的图片
        const toDelete = [...selectedImages.value]
        const deletedImages = new Set<string>()
        const deletedFeatureCodes = new Set<string>()

        // 分批删除文件，避免阻塞主线程
        const BATCH_SIZE = 20 // 文件操作较重，每批少一些

        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = toDelete.slice(i, i + BATCH_SIZE)

            // 并发删除这一批文件
            const results = await Promise.allSettled(
                batch.map(async image => {
                    const success = await window.p.removeImage(
                        openedGroup.value,
                        image
                    )
                    return { image, success }
                })
            )

            // 收集成功删除的图片
            for (const result of results) {
                if (
                    result.status === 'fulfilled' &&
                    result.value.success
                ) {
                    const image = result.value.image
                    deletedImages.add(image)

                    // 检查是否有关键字需要移除
                    const featureCode = `${openedGroup.value}/${image}`
                    if (featureCodes.value.includes(featureCode)) {
                        if (utools.removeFeature(featureCode)) {
                            deletedFeatureCodes.add(featureCode)
                        }
                    }
                }
            }

            // 让出主线程，避免卡顿
            if (i + BATCH_SIZE < toDelete.length) {
                await new Promise(resolve => setTimeout(resolve, 0))
            }
        }

        // 一次性更新响应式数据
        if (deletedImages.size > 0) {
            imageList.value = imageList.value.filter(
                image => !deletedImages.has(image)
            )
        }

        if (deletedFeatureCodes.size > 0) {
            featureCodes.value = featureCodes.value.filter(
                code => !deletedFeatureCodes.has(code)
            )
        }

        // 保存配置
        saveImageProfile()

        // 清理已删除图片的选中状态
        if (deletedImages.size > 0) {
            selectedImages.value = selectedImages.value.filter(
                image => !deletedImages.has(image)
            )
            updateAllSelectedState()
        }

        loading.value = false

        // 显示结果
        const successCount = deletedImages.size
        const totalCount = toDelete.length
        if (successCount === totalCount) {
            ElMessage.success({
                message: '删除成功',
                showClose: true
            })
        } else if (successCount === 0) {
            ElMessage.warning({
                message: '删除失败',
                showClose: true
            })
        } else {
            ElMessage.info({
                message: `删除成功 ${successCount} 张，失败 ${totalCount - successCount} 张`,
                showClose: true
            })
        }
    })
}

const showImageContextMenu = (event: MouseEvent, image: string, index: number, filter?: boolean) => {
    clientX.value = event.clientX;
    clientY.value = event.clientY;
    const isKeyword = featureCodes.value.includes(`${openedGroup.value}/${image}`)
    const imageMenuList = [
        {
            icon: 'edit',
            name: '修改图片名称',
            clickFn: () => handleImageEditBtnClick(image, index),
            show: imageNumPerRow.value > 1
        },
        {
            icon: isKeyword ? 'star-fill' : 'star',
            name: isKeyword ? '移除utools关键字' : '设为utools关键字',
            clickFn: () => handleKeywordBtnClick(image),
        },
        {
            icon: 'copy-image',
            name: '复制图片',
            clickFn: () => handleImageCopyBtnClick(image),
            show: imageNumPerRow.value > 2,
            title: '仅支持png/jpg/jpeg/ico，其他格式将转为复制图片文件'
        },
        {
            icon: 'copy-file',
            name: '复制图片文件',
            clickFn: () => handleImageFileCopyBtnClick(image),
            show: imageNumPerRow.value > 1
        },
        {
            icon: 'paste-image',
            name: '粘贴图片',
            clickFn: () => handleImagePasteBtnClick(image),
            show: imageNumPerRow.value > 1,
            title: '仅支持png/jpg/jpeg/ico，其他格式将转为粘贴图片文件'
        },
        {
            icon: 'paste-file',
            name: '粘贴图片文件',
            clickFn: () => handleImageFilePasteBtnClick(image),
            show: imageNumPerRow.value > 1
        },
        {
            icon: 'fullscreen',
            name: '全屏展示',
            clickFn: () => handleImageFullscreenBtnClick(image),
            show: imageNumPerRow.value > 2
        },
        {
            icon: 'image',
            name: '打开图片',
            clickFn: () => handleImageOpenBtnClick(image),
            show: imageNumPerRow.value > 1
        },
        {
            icon: 'delete',
            name: '删除图片',
            clickFn: () => handleImageRemoveBtnClick(image, index),
            show: imageNumPerRow.value > 1
        }
    ]
    if (filter) {
        menuList.value = imageMenuList.filter(({show}) => !!show)
    } else {
        menuList.value = imageMenuList
    }
    contextMenuVisible.value = true
}

const handleGroupContextMenu = (event: MouseEvent, group: string, index: number) => {
    clientX.value = event.clientX;
    clientY.value = event.clientY;
    groupIndex.value = index
    menuList.value = [
        {
            icon: 'edit',
            name: '重命名',
            clickFn: () => {
                isGroupAdd.value = false
                groupName.value = group
                groupDialogVisible.value = true
            }
        },
        {
            icon: 'delete',
            name: '删除分组',
            clickFn: () => removeGroup(group)
        },
    ]
    contextMenuVisible.value = true

}
const handleOverlayClick = () => {
    // 点击遮罩层的任意位置，隐藏上下文菜单。由于上下文菜单在遮罩层之上，故点击上下文菜单时，不会触发该事件
    contextMenuVisible.value = false
}

const removeGroup = (group: string) => {
    ElMessageBox.confirm(
        `确定删除分组「${group}」？分组删除后该分组下的所有图片也将一并删除，该操作无法恢复！！！`,
        '提示',
        {
            confirmButtonText: '确定删除',
            confirmButtonClass: 'el-button--danger',
            cancelButtonText: '取消',
            type: 'warning',
        } as ElMessageBoxOptions
    )
        .then(async () => {
            loading.value = true
            const success = await window.p.removeGroup(group)
            loading.value = false
            if (!success) {
                ElMessage.warning({
                    message: '删除失败',
                    showClose: true
                })
                return
            }
            ElMessage.success({
                message: '删除成功',
                showClose: true
            })
            const temp: string[] = []
            featureCodes.value.forEach((featureCode: string) => {
                if (featureCode.startsWith(`${group}/`)) {
                    utools.removeFeature(featureCode)
                } else {
                    temp.push(featureCode)
                }
            })
            featureCodes.value = temp
            groupList.value.splice(groupIndex.value, 1)
            if (groupList.value.length && group === openedGroup.value) {
                // handleGroupChange中会执行saveGroupProfile
                handleGroupChange(
                    groupList.value[groupIndex.value] || groupList.value[groupIndex.value - 1])
            } else {
                saveGroupProfile()
            }
        })
}
const handleGroupClick = (group: string) => {
    if (group === openedGroup.value) {
        return
    }
    handleGroupChange(group)
}
const handleGroupAddBtnClick = () => {
    groupName.value = ''
    isGroupAdd.value = true
    groupDialogVisible.value = true
}

const handleGroupInput = (val: string) => {
    const pattern = getInvalidCharsPattern()
    if (pattern.test(val)) {
        tipsVisible.value = true
        groupName.value = val.replace(pattern, '')
    } else {
        tipsVisible.value = false
    }
}

// 获取当前系统的非法字符正则
const getInvalidCharsPattern = (): RegExp => {
    if (utools.isWindows()) {
        // Windows: \ / : * ? " < > |
        return /[\\/:*?"<>|]/g
    } else if (utools.isMacOS()) {
        // macOS: / 和 :
        return /[/:]/g
    } else {
        // Linux: /
        return /\//g
    }
}

// 获取当前系统的非法字符提示
const getInvalidCharsTip = (): string => {
    if (utools.isWindows()) {
        return '名称不能包含 \\ / : * ? " < > | 等字符'
    } else if (utools.isMacOS()) {
        return '名称不能包含 / 或 : 字符'
    } else {
        return '名称不能包含 / 字符'
    }
}

const handleImageInput = (val: string) => {
    const pattern = getInvalidCharsPattern()
    if (pattern.test(val)) {
        tipsVisible.value = true
        imageName.value = val.replace(pattern, '')
    } else {
        tipsVisible.value = false
    }
}

const handleBatchImageInput = (val: string, image: {name: string, extension: string, tipsVisible: boolean}) => {
    const pattern = getInvalidCharsPattern()
    if (pattern.test(val)) {
        image.tipsVisible = true
        image.name = val.replace(pattern, '')
    } else {
        image.tipsVisible = false
    }
}

const handleImageBatchEditConfirmBtnClick = async () => {
    // 1. 预处理：去除空格
    batchEditImages.value.forEach(image => {
        image.name = image.name.trim()
    })

    // 2. 验证所有文件名
    const errors: string[] = []
    const newNames: string[] = []

    const allOriginalNames = batchEditImages.value.map(img => img.originalName)

    for (let i = 0; i < batchEditImages.value.length; i++) {
        const { originalName, name, extension } = batchEditImages.value[i]
        const newFileName = `${name}${extension}`

        // 验证文件名合法性
        const validation = window.p.validateFileName(newFileName)
        if (!validation.valid) {
            errors.push(`「${originalName}」: ${validation.error}`)
            continue
        }

        // 检查新名称是否与其他待修改的名称重复
        if (newNames.includes(newFileName)) {
            errors.push(`「${originalName}」: 新名称与其他图片重复`)
            continue
        }

        // 检查新名称是否与现有图片重复（排除自身和其他待修改的图片）
        const existingIndex = imageList.value.indexOf(newFileName)
        if (existingIndex !== -1 && !allOriginalNames.includes(newFileName)) {
            errors.push(`「${originalName}」: 新名称与现有图片重复`)
            continue
        }

        newNames.push(newFileName)
    }

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
        ElMessage.warning({
            message: `验证失败：${errors[0]}${errors.length > 1 ? ` 等 ${errors.length} 个错误` : ''}`,
            showClose: true
        })
        return
    }

    // 3. 构建重命名任务列表（只包含名称有变化的）
    const renameTasks: {
        originalImage: string
        newImage: string
        index: number
    }[] = []

    for (let i = 0; i < batchEditImages.value.length; i++) {
        const { originalName, name, extension } = batchEditImages.value[i]
        const newImage = `${name}${extension}`

        if (originalName !== newImage) {
            // 找到在 imageList 中的索引
            const imageListIndex = imageList.value.indexOf(originalName)
            if (imageListIndex !== -1) {
                renameTasks.push({
                    originalImage: originalName,
                    newImage,
                    index: imageListIndex
                })
            }
        }
    }

    // 如果没有需要修改的，直接关闭
    if (renameTasks.length === 0) {
        imageBatchEditDialogVisible.value = false
        ElMessage.info({
            message: '没有需要修改的图片',
            showClose: true
        })
        return
    }

    // 4. 分批并发执行重命名
    // 验证阶段已确保所有重命名操作互不冲突，可以安全并发
    loading.value = true

    const successResults: {
        originalImage: string
        newImage: string
        index: number
    }[] = []
    const failedResults: { originalImage: string; error: string }[] = []
    const updatedFeatureCodes: {
        oldCode: string
        newCode: string
        index: number
    }[] = []

    const BATCH_SIZE = 20 // 每批并发 20 个

    for (let i = 0; i < renameTasks.length; i += BATCH_SIZE) {
        const batch = renameTasks.slice(i, i + BATCH_SIZE)

        // 并发执行这一批重命名
        const results = await Promise.allSettled(
            batch.map(async task => {
                const result = await window.p.renameImage(
                    openedGroup.value,
                    task.originalImage,
                    task.newImage
                )
                return { task, result }
            })
        )

        // 处理结果
        for (const promiseResult of results) {
            if (promiseResult.status === 'fulfilled') {
                const { task, result } = promiseResult.value

                if (result.success) {
                    successResults.push(task)

                    // 检查是否有关键字需要更新
                    const oldFeatureCode = `${openedGroup.value}/${task.originalImage}`
                    const featureIndex = featureCodes.value.indexOf(oldFeatureCode)
                    if (featureIndex !== -1) {
                        const newFeatureCode = `${openedGroup.value}/${task.newImage}`
                        if (utools.removeFeature(oldFeatureCode)) {
                            if (
                                utools.setFeature({
                                    code: newFeatureCode,
                                    explain: task.newImage,
                                    platform: ['win32', 'darwin', 'linux'],
                                    cmds: [task.newImage]
                                })
                            ) {
                                updatedFeatureCodes.push({
                                    oldCode: oldFeatureCode,
                                    newCode: newFeatureCode,
                                    index: featureIndex
                                })
                            }
                        }
                    }
                } else {
                    failedResults.push({
                        originalImage: task.originalImage,
                        error: result.error || '未知错误'
                    })
                }
            } else {
                // Promise rejected（不太可能发生）
                const task = batch[results.indexOf(promiseResult)]
                failedResults.push({
                    originalImage: task.originalImage,
                    error: '操作异常'
                })
            }
        }

        // 让出主线程，避免卡顿
        if (i + BATCH_SIZE < renameTasks.length) {
            await new Promise(resolve => setTimeout(resolve, 0))
        }
    }

    // 5. 一次性更新响应式数据
    if (successResults.length > 0) {
        // 更新 imageList
        for (const { index, newImage } of successResults) {
            imageList.value[index] = newImage
        }

        // 更新 featureCodes
        for (const { index, newCode } of updatedFeatureCodes) {
            featureCodes.value[index] = newCode
        }

        // 更新 selectedImages 中的图片名称
        const renameMap = new Map(successResults.map(r => [r.originalImage, r.newImage]))
        selectedImages.value = selectedImages.value.map(image => 
            renameMap.get(image) || image
        )

        // 保存配置
        saveImageProfile()

        // 重新观察图片（因为名称变化导致 DOM 更新）
        observeImages()
    }

    loading.value = false
    imageBatchEditDialogVisible.value = false

    // 6. 显示结果
    const totalCount = renameTasks.length
    const successCount = successResults.length

    if (successCount === totalCount) {
        ElMessage.success({
            message: `成功修改 ${successCount} 张图片名称`,
            showClose: true
        })
    } else if (successCount === 0) {
        ElMessage.warning({
            message: `修改失败：${failedResults[0].error}`,
            showClose: true
        })
    } else {
        ElMessage.info({
            message: `成功 ${successCount} 张，失败 ${failedResults.length} 张`,
            showClose: true
        })
    }
}

const getImagePath = (image: string) => {
    return window.p.getImagePath(openedGroup.value, image)
}

const handleImageDialogConfirmBtnClick = async () => {
    imageName.value = imageName.value.trim()
    const newImage = `${imageName.value}${imageExtension.value}`
    
    // 使用后端验证函数检查文件名合法性
    const validation = window.p.validateFileName(newImage)
    if (!validation.valid) {
        ElMessage.warning({
            message: `修改失败，${validation.error}`,
            showClose: true
        })
        return
    }
    
    // 检查名称是否重复（排除当前图片自身）
    const existingIndex = imageList.value.indexOf(newImage)
    if (existingIndex !== -1 && existingIndex !== imageIndex.value) {
        ElMessage.warning({
            message: '修改失败，图片名称重复',
            showClose: true
        })
        return
    }
    
    const originalImage = imageList.value[imageIndex.value]
    
    // 如果名称没有变化，直接关闭对话框
    if (originalImage === newImage) {
        imageDialogVisible.value = false
        return
    }
    
    // 执行重命名操作
    loading.value = true
    const result = await window.p.renameImage(openedGroup.value, originalImage, newImage)
    loading.value = false
    
    if (!result.success) {
        ElMessage.warning({
            message: `修改失败，${result.error}`,
            showClose: true
        })
        return
    }
    
    // 更新关键字（如果有）
    const featureCode = `${openedGroup.value}/${originalImage}`
    const index = featureCodes.value.indexOf(featureCode)
    if (index !== -1) {
        utools.removeFeature(featureCode)
        const newFeatureCode = `${openedGroup.value}/${newImage}`
        utools.setFeature({
            "code": newFeatureCode,
            "explain": newImage,
            "platform": ["win32", "darwin", "linux"],
            "cmds": [newImage]
        })
        featureCodes.value[index] = newFeatureCode
        ElMessage.success({
            message: '修改成功，关键字已同步更新',
            showClose: true
        })
    } else {
        ElMessage.success({
            message: '修改成功',
            showClose: true
        })
    }
    
    // 更新 UI
    imageList.value[imageIndex.value] = newImage
    saveImageProfile()
    imageDialogVisible.value = false
    
    // 重新观察图片元素（因为 Vue 会重新渲染，新元素需要被观察）
    observeImages()
}

const handleFolderOpenBtnClick = () => {
    utools.shellOpenPath(window.p.getImagesDir())
}

const handleGlobalLayoutBtnClick = () => {
    globalImageNumPerRowTemp.value = globalImageNumPerRow.value
    globalLayoutDialogVisible.value = true
}

const handleDraggableChange = () => {
    saveGroupProfile()
}

const handleKeywordBtnClick = (image: string) => {
    const featureCode = `${openedGroup.value}/${image}`
    if (featureCodes.value.includes(featureCode)) {
        removeKeyword(featureCode, image)
    } else {
        addKeyword(featureCode, image)
    }
}

const removeKeyword = (featureCode: string, image: string) => {
    if (utools.removeFeature(featureCode)) {
        featureCodes.value = featureCodes.value.filter((_featureCode: string) => _featureCode !== featureCode)
        ElMessage.success({
            message: `已移除「${image}」utools关键字`,
            showClose: true
        })
    }
}

const addKeyword = (featureCode: string, image: string) => {
    if (utools.setFeature({
        "code": featureCode,
        "explain": image,
        "platform": ["win32", "darwin", "linux"],
        "cmds": [image]
    })) {
        featureCodes.value.push(featureCode)
        ElMessage.success({
            message: `设置成功，外部可搜索「${image}」展示图片`,
            showClose: true
        })
    }
}

const saveGroupProfile = () => {
    window.p.saveGroupProfile({
        lastOpenedGroup: openedGroup.value,
        groupsOrder: groupList.value,
        imageNumPerRow: globalImageNumPerRow.value
    })
}

const saveImageProfile = () => {
    window.p.saveImageProfile(openedGroup.value, {
        imagesOrder: imageList.value,
        imageNumPerRow: groupImageNumPerRow.value
    })
}

const handleDrop = (event: DragEvent) => {
    // 阻止默认行为（防止浏览器打开文件）
    event.preventDefault()
    
    // 检查是否有文件
    if (!event.dataTransfer?.files?.length) {
        return
    }
    
    // 过滤出图片文件（使用 MIME 类型）
    const imageFiles = [...event.dataTransfer.files].filter((file: File) => 
        supportImageMIME.includes(file.type)
    )
    
    // 如果没有图片，给出提示
    if (imageFiles.length === 0) {
        ElMessage.warning({
            message: '未检测到图片文件，或图片格式不支持',
            showClose: true
        })
        return
    }
    
    // 提取文件路径（Electron 环境中 File 对象有 path 属性）
    const filePaths = imageFiles.map((file: any) => file.path)
    
    // 批量上传（使用 copyImage，已优化为原子操作）
    saveImageHandler(
        (path) => window.p.copyImage(path, openedGroup.value), 
        filePaths
    )
}

onMounted(async () => {
    // 初始化图片懒加载观察器
    initImageObserver()
    
    const features = utools.getFeatures()
    featureCodes.value = features.map((feature: any) => feature.code)

    const {list, profile} = window.p.getGroupListAndProfile()
    groupList.value = list
    globalImageNumPerRow.value = profile.imageNumPerRow || 1
    const lastOpenedGroup = profile.lastOpenedGroup

    if (props.pluginCode === 'imageRecordAndView') {
        if (groupList.value.length) {
            handleGroupChange(
                lastOpenedGroup && groupList.value.includes(lastOpenedGroup)
                    ? lastOpenedGroup : groupList.value[0])
        }
    } else {
        const [group, image] = props.pluginCode.split('/')
        if (!groupList.value.includes(group)) {
            ElMessage.warning({
                message: '该图片所在的分组不存在',
                showClose: true
            })
            if (groupList.value.length) {
                handleGroupChange(
                    lastOpenedGroup && groupList.value.includes(lastOpenedGroup)
                        ? lastOpenedGroup : groupList.value[0])
            }
        } else {
            await handleGroupChange(group)
            const index = imageList.value.indexOf(image)
            if (index === -1) {
                ElMessage.warning({
                    message: '该图片不存在',
                    showClose: true
                })
            } else {
                // 边界检查：确保索引有效
                if (index >= 0 && index < imageList.value.length) {
                    fullscreenImage.value = image
                    fullscreenVisible.value = true
                }
            }
        }
    }

    utools.setSubInput(({text}: any) => {
        search.value = text
    }, '在当前分组中搜索图片')
})

// 组件卸载时清理 Observer
onUnmounted(() => {
    if (imageObserver) {
        imageObserver.disconnect()
        imageObserver = null
    }
})

</script>

<template>
    <div class="main-container" v-loading="loading">
        <div class="left" v-show="showSidebar">
            <div class="header left-header">
                <div class="header-btn circle" title="新建图片分组" @click="handleGroupAddBtnClick">
                    <SvgIcon name="folder-add"></SvgIcon>
                </div>

                <el-dropdown>
                  <div class="header-btn circle">
                    <SvgIcon name="folder-open"></SvgIcon>
                  </div>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="emit('setting')">设置图片文件夹</el-dropdown-item>
                      <el-dropdown-item @click="handleFolderOpenBtnClick">打开图片文件夹</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>

                <div class="header-btn circle" title="设置布局" @click="handleGlobalLayoutBtnClick">
                    <SvgIcon name="layout"></SvgIcon>
                </div>
                <el-dialog
                        v-model="groupDialogVisible"
                        :title="isGroupAdd ? '新建图片分组' : '分组重命名'"
                        width="400"
                        @opened="isGroupAdd ? groupInputRef.focus() : groupInputRef.select()"
                >
                    <el-popover
                            :visible="tipsVisible"
                            placement="bottom"
                            :width="280"
                            :content="getInvalidCharsTip()"
                    >
                        <template #reference>
                            <el-input ref="groupInputRef"
                                      v-model="groupName"
                                      placeholder="输入分组名称"
                                      @input="handleGroupInput"
                                      @blur="tipsVisible=false"
                                      @keyup.enter="handleGroupDialogConfirmBtnClick"
                            ></el-input>
                        </template>
                    </el-popover>
                    <template #footer>
                        <div class="dialog-footer">
                            <el-button @click="groupDialogVisible = false">取消</el-button>
                            <el-button type="primary" @click="handleGroupDialogConfirmBtnClick">
                                确定
                            </el-button>
                        </div>
                    </template>
                </el-dialog>
            </div>
            <div class="body">
                <draggable :list="groupList" ghost-class="ghost"
                           :item-key="(item: string) => item" :disabled="search"
                           @change="handleDraggableChange">
                    <template #item="{element, index}">
                        <div :class="[
                         'group-item',
                         {'group-item-selected': element === openedGroup},
                         ]"
                             @click="handleGroupClick(element)"
                             @contextmenu="handleGroupContextMenu($event, element, index)">
                            {{ element }}
                        </div>
                    </template>
                </draggable>
            </div>
        </div>
        <div :class="showSidebar ? 'right' : 'full'">
            <template v-if="groupList.length">
                <div class="header right-header">
                    <div class="right-header-left">
                        <div class="header-btn square" :title="showSidebar ? '隐藏侧边栏' : '显示侧边栏'"
                             @click="showSidebar=!showSidebar">
                            <SvgIcon :name="showSidebar ? 'double-left' : 'double-right'"></SvgIcon>
                        </div>
                        <div class="title">{{ openedGroup }}</div>
                    </div>
                    <div class="right-header-right">
                        <div title="「拖拽上传」拖拽图片到下方上传"
                             style="display: flex;
                             justify-content: center;
                             align-items: center;
                             width: 35px;
                             height: 35px;">
                          <SvgIcon name="drag"></SvgIcon>
                        </div>
                        <div class="header-btn square" title="「本地上传」从本地选择一张或多张图片上传"
                             @click="handleUploadBtnClick">
                            <SvgIcon name="upload"></SvgIcon>
                        </div>
                        <div class="header-btn square" title="「截图上传」截取一张图片上传"
                             @click="handleScreenshotBtnClick">
                            <SvgIcon name="screenshot"></SvgIcon>
                        </div>
                        <div class="header-btn square" title="「剪贴板上传」将最近一次复制的一张或多张图片上传"
                             @click="handleClipboardBtnClick">
                            <SvgIcon name="clipboard"></SvgIcon>
                        </div>
                        <el-divider direction="vertical" style="border-color: #999999"/>
                        <div class="header-btn square" title="批量操作" @click="handleBatchBtnClick">
                            <SvgIcon name="batch"></SvgIcon>
                        </div>
                        <div class="header-btn square" title="设置分组布局" @click="handleGroupLayoutBtnClick">
                            <SvgIcon name="layout"></SvgIcon>
                        </div>
                        <el-divider direction="vertical" style="border-color: #999999"/>
                        <div style="color: #757575">
                            <template v-if="search">
                                搜索到{{ filteredImageList.length }}张图片 / 共{{ imageList.length }}张
                            </template>
                            <template v-else>
                                共{{ imageList.length }}张图片
                            </template>
                        </div>
                    </div>
                </div>
                <div v-if="imageList.length" class="image-list" @drop="handleDrop" @dragover.prevent>
                    <div v-if="filteredImageList.length === 0" style="width: 100%; text-align: center; padding: 40px 0; color: #909399;">
                        未找到匹配的图片
                    </div>
                    <div class="image-item"
                         :style="{width: `calc((100% - ${(imageNumPerRow-1)*20}px) / ${imageNumPerRow})`}"
                         v-for="image in filteredImageList" :key="image">
                        <div class="header image-item-header">
                            <div class="image-item-header-left" :title="image">{{ image }}</div>
                            <div class="image-item-header-right">
                                <div v-if="imageNumPerRow===1" class="header-btn square" title="修改图片名称"
                                     @click="handleImageEditBtnClick(image, imageList.indexOf(image))">
                                    <SvgIcon name="edit"></SvgIcon>
                                </div>
                                <div class="header-btn square"
                                     :title="featureCodes.includes(`${openedGroup}/${image}`) ? '移除utools关键字' : '设为utools关键字'"
                                     @click="handleKeywordBtnClick(image)">
                                    <SvgIcon
                                            :name="featureCodes.includes(`${openedGroup}/${image}`) ? 'star-fill' : 'star'"></SvgIcon>
                                </div>
                                <div v-if="imageNumPerRow<=2" class="header-btn square"
                                     title="复制图片（仅支持png/jpg/jpeg/ico，其他格式将转为复制图片文件）"
                                     @click="handleImageCopyBtnClick(image)">
                                    <SvgIcon name="copy-image"></SvgIcon>
                                </div>
                                <div v-if="imageNumPerRow==1" class="header-btn square" title="复制图片文件"
                                     @click="handleImageFileCopyBtnClick(image)">
                                    <SvgIcon name="copy-file"></SvgIcon>
                                </div>
                                <div v-if="imageNumPerRow===1" class="header-btn square"
                                     title="粘贴图片（仅支持png/jpg/jpeg/ico，其他格式将转为粘贴图片文件）"
                                     @click="handleImagePasteBtnClick(image)">
                                    <SvgIcon name="paste-image"></SvgIcon>
                                </div>
                                <div v-if="imageNumPerRow===1" class="header-btn square" title="粘贴图片文件"
                                     @click="handleImageFilePasteBtnClick(image)">
                                    <SvgIcon name="paste-file"></SvgIcon>
                                </div>
                                <div v-if="imageNumPerRow<=2" class="header-btn square" title="全屏展示"
                                     @click="handleImageFullscreenBtnClick(image)">
                                    <SvgIcon name="fullscreen"></SvgIcon>
                                </div>
                                <div v-if="imageNumPerRow===1" class="header-btn square" title="打开图片"
                                     @click="handleImageOpenBtnClick(image)">
                                    <SvgIcon name="image"></SvgIcon>
                                </div>
                                <div v-if="imageNumPerRow===1" class="header-btn square" title="删除图片"
                                     @click="handleImageRemoveBtnClick(image, imageList.indexOf(image))">
                                    <SvgIcon name="delete"></SvgIcon>
                                </div>
                                <div v-if="imageNumPerRow>=2" class="header-btn square" title="更多"
                                     @click="showImageContextMenu($event, image, imageList.indexOf(image), true)">
                                    <SvgIcon name="more"></SvgIcon>
                                </div>
                            </div>
                        </div>
                        <div class="image-item-body">
                            <img class="lazy-image" 
                                 style="max-width: 100%" 
                                 src=""
                                 :data-src="getImagePath(image)" 
                                 :title="image"
                                 @contextmenu="showImageContextMenu($event, image, imageList.indexOf(image))">
                        </div>
                    </div>
                </div>
                <el-empty v-else description="空空如也" @drop="handleDrop" @dragover.prevent>
                    <div style="text-align: left; color: #909399; margin-bottom: 15px; line-height: 1.5">
                        <p>「拖拽上传」拖拽图片到此处上传</p>
                        <p>「本地上传」从本地选择一张或多张图片上传</p>
                        <p>「截图上传」截取一张图片上传</p>
                        <p>「剪贴板上传」将最近一次复制的一张或多张图片上传</p>
                        <p>支持的图片格式：png、jpg、jpeg、gif、webp、bmp、svg、ico</p>
                    </div>
                    <el-button color="#626aef" @click="handleUploadBtnClick">本地上传</el-button>
                    <el-button color="#626aef" @click="handleScreenshotBtnClick">截图上传</el-button>
                    <el-button color="#626aef" @click="handleClipboardBtnClick">剪贴板上传</el-button>
                </el-empty>
            </template>
            <el-empty v-else description="空空如也">
                <div style="text-align: left; color: #909399; margin-bottom: 15px;">
                    <p>在上传图片之前，先新建一个图片分组吧</p>
                </div>
                <el-button color="#626aef" @click="handleGroupAddBtnClick">新建图片分组</el-button>
            </el-empty>
        </div>
        <div class="fullscreen" v-show="fullscreenVisible">
            <div class="header" style="justify-content: flex-end; padding-right: 10px">
                <div class="header-btn square" title="退出全屏" @click="fullscreenVisible=false">
                    <SvgIcon name="fullscreen-exit"></SvgIcon>
                </div>
            </div>
            <div class="body" style="text-align: center">
                <img :src="getImagePath(fullscreenImage)" style="max-width: 100%">
            </div>
        </div>
        <el-dialog
                v-model="imageDialogVisible"
                title="修改图片名称"
                width="400"
                @opened="imageInputRef.select()"
        >
            <el-popover
                    :visible="tipsVisible"
                    placement="bottom"
                    :width="280"
                    :content="getInvalidCharsTip()"
            >
                <template #reference>
                    <el-input ref="imageInputRef"
                              v-model="imageName"
                              placeholder="输入图片名称"
                              @input="handleImageInput"
                              @blur="tipsVisible=false">
                        <template #append>{{ imageExtension }}</template>
                    </el-input>
                </template>
            </el-popover>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="imageDialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="handleImageDialogConfirmBtnClick">
                        确定
                    </el-button>
                </div>
            </template>
        </el-dialog>
        <el-dialog
                v-model="groupLayoutDialogVisible"
                title="设置分组布局"
                width="400"
        >
            每行要展示的图片数量：
            <el-select style="width: 150px" v-model="groupImageNumPerRowTemp">
                <el-option :value="0" label="使用全局布局"></el-option>
                <el-option :value="1" label="1"></el-option>
                <el-option :value="2" label="2"></el-option>
                <el-option :value="3" label="3"></el-option>
                <el-option :value="4" label="4"></el-option>
            </el-select>
            <div style="font-size: 12px; color: #ababab; margin-top: 10px">
                *该布局仅应用于当前分组，若想设置全局布局，点击侧边栏顶部的「设置布局」。全局布局不会覆盖分组布局。
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="groupLayoutDialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="() => {
                            groupImageNumPerRow = groupImageNumPerRowTemp
                            groupLayoutDialogVisible = false
                            saveImageProfile()
                        }">
                        确定
                    </el-button>
                </div>
            </template>
        </el-dialog>
        <el-dialog
                v-model="globalLayoutDialogVisible"
                title="设置布局"
                width="400"
        >
            每行要展示的图片数量：
            <el-select style="width: 150px" v-model="globalImageNumPerRowTemp">
                <el-option :value="1" label="1（默认）"></el-option>
                <el-option :value="2" label="2"></el-option>
                <el-option :value="3" label="3"></el-option>
                <el-option :value="4" label="4"></el-option>
            </el-select>
            <div style="font-size: 12px; color: #ababab; margin-top: 10px">
                *该布局会应用于所有分组，若想单独为分组设置布局，点击分组中的「设置分组布局」。全局布局不会覆盖分组布局。
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="globalLayoutDialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="() => {
                            globalImageNumPerRow = globalImageNumPerRowTemp
                            globalLayoutDialogVisible = false
                            saveGroupProfile()
                        }">
                        确定
                    </el-button>
                </div>
            </template>
        </el-dialog>
        <el-dialog
                v-model="batchDialogVisible"
                title="批量操作"
                top="10vh"
                style="margin-bottom: 0"
                width="60%"
                :z-index="99"
                @close="selectedImages = []; allSelected = false"
        >
            <el-button style="margin: 0 8px 8px 0; height: 28px;" color="#626aef" @click="handleImageBatchEditBtnClick">修改图片名称
            </el-button>
            <el-button style="margin: 0 8px 8px 0; height: 28px;" color="#626aef" @click="handleKeywordBatchSetBtnClick">设为utools关键字
            </el-button>
            <el-button style="margin: 0 8px 8px 0; height: 28px;" color="#626aef" @click="handleKeywordBatchRemoveBtnClick">移除utools关键字
            </el-button>
            <el-button style="margin: 0 8px 8px 0; height: 28px;" color="#626aef" @click="handleImageFileBatchCopyBtnClick">
                复制图片文件
            </el-button>
            <el-button style="margin: 0 8px 8px 0; height: 28px;" color="#626aef" @click="handleImageFileBatchPasteBtnClick">粘贴图片文件
            </el-button>
            <el-button style="margin: 0 8px 8px 0; height: 28px;" type="danger" @click="handleImageBatchRemoveBtnClick">删除
            </el-button>
            <div v-if="search" style="margin-bottom: 8px; color: #909399; font-size: 14px;">
                当前搜索：<span style="color: #303133; font-weight: 500;">{{ search }}</span>，仅显示匹配的 {{ filteredImageList.length }} 张图片
            </div>
            
            <!-- 虚拟列表容器 -->
            <div class="batch-list-container">
                <!-- 表头 -->
                <div class="batch-list-header">
                    <div class="batch-list-cell" style="width: 30px; padding-left: 12px;">
                        <input 
                            type="checkbox" 
                            :checked="allSelected"
                            @change="toggleAllSelection"
                            style="cursor: pointer; width: 16px; height: 16px;"
                        />
                    </div>
                    <div class="batch-list-cell" style="width: 34px;"></div>
                    <div class="batch-list-cell" style="width: 34px;"></div>
                    <div class="batch-list-cell batch-list-cell-content" style="flex: 1; min-width: 0;">图片名称</div>
                </div>
                
                <!-- 虚拟滚动列表 -->
                <RecycleScroller
                    class="batch-scroller"
                    :items="virtualListItems"
                    :item-size="40"
                    key-field="id"
                >
                    <template #default="{ item }">
                        <div class="batch-list-row" :class="{ 'selected': isImageSelected(item.name) }">
                            <div class="batch-list-cell" style="width: 30px; padding-left: 12px;">
                                <input 
                                    type="checkbox" 
                                    :checked="isImageSelected(item.name)"
                                    @change="toggleImageSelection(item.name)"
                                    style="cursor: pointer; width: 16px; height: 16px;"
                                />
                            </div>
                            <div class="batch-list-cell" style="width: 34px;">
                                <div style="display: flex; align-items: center"
                                     :title="featureCodes.includes(`${openedGroup}/${item.name}`) ? '已设为关键字' : '未设为关键字'">
                                    <SvgIcon :name="featureCodes.includes(`${openedGroup}/${item.name}`) ? 'star-fill' : 'star'"></SvgIcon>
                                </div>
                            </div>
                            <div class="batch-list-cell" style="width: 34px;">
                                <el-popover :popper-style="{width: 'auto', minWidth: 0, padding: 0}" placement="right">
                                    <template #reference>
                                        <div style="display: flex; align-items: center; cursor: pointer">
                                            <SvgIcon name="view"></SvgIcon>
                                        </div>
                                    </template>
                                    <img :src="getImagePath(item.name)" style="max-width: 300px; display: block">
                                </el-popover>
                            </div>
                            <div class="batch-list-cell batch-list-cell-content" style="flex: 1; min-width: 0;" :title="item.name">
                                {{ item.name }}
                            </div>
                        </div>
                    </template>
                </RecycleScroller>
            </div>
        </el-dialog>
        <el-dialog
            v-model="imageBatchEditDialogVisible"
            title="批量修改图片名称"
            width="500"
        >
            <!-- 虚拟列表容器 -->
            <div class="batch-edit-container">
                <RecycleScroller
                    class="batch-edit-scroller"
                    :items="batchEditImages"
                    :item-size="42"
                    key-field="id"
                >
                    <template #default="{ item }">
                        <div class="batch-edit-item">
                            <el-popover
                                :visible="item.tipsVisible"
                                placement="bottom"
                                :width="280"
                                :content="getInvalidCharsTip()"
                            >
                                <template #reference>
                                    <el-input
                                        v-model="item.name"
                                        placeholder="输入图片名称"
                                        @input="(val: string) => {handleBatchImageInput(val, item)}"
                                        @blur="item.tipsVisible=false"
                                        size="default"
                                    >
                                        <template #append>{{ item.extension }}</template>
                                    </el-input>
                                </template>
                            </el-popover>
                        </div>
                    </template>
                </RecycleScroller>
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="imageBatchEditDialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="handleImageBatchEditConfirmBtnClick">
                        确定
                    </el-button>
                </div>
            </template>
        </el-dialog>


        <div v-if="contextMenuVisible" class="overlay" @click="handleOverlayClick"
             @contextmenu="handleOverlayClick"></div>
        <ContextMenu
                v-if="contextMenuVisible"
                :client-x="clientX"
                :client-y="clientY"
                :menu-list="menuList"
                @after-click="contextMenuVisible=false"
        />
    </div>
</template>

<style scoped>
.main-container {
    display: flex;
}

.left {
    width: 22.5%;
}

.right {
    width: 77.5%;
    border-left: 1px solid #ccc;
    box-sizing: border-box;
}

.full {
    width: 100%;
}

.header {
    display: flex;
    align-items: center;
    height: 39px;
    border-bottom: 1px solid #ccc;
}

.body {
    height: calc(100vh - 40px);
    overflow-y: auto;
}

.header-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 35px;
    height: 35px;
    cursor: pointer;
}
.image-item-header .header-btn {
    width: 32px;
    height: 32px;
}

.header-btn:hover {
    background-color: #EAEAEA;
}

.left-header {
    padding: 0 10px;
}

.circle {
    border-radius: 50%;
}

.right-header {
    padding: 0 10px 0 2px;
}

.right-header-left {
    width: calc(100% - 335px);
    display: flex;
    align-items: center;
}

.title {
    font-size: 20px;
    width: calc(100% - 35px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.right-header-right {
    width: 335px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
}

.square {
    border-radius: 10px;
}

.image-list {
    display: flex;
    max-height: calc(100vh - 60px);
    overflow-y: auto;
    padding: 10px;
    gap: 20px;
    flex-wrap: wrap;
    /*align-items: baseline;*/
}

.image-item {
    background-color: white;
    border-radius: 4px;
    box-shadow: 0 0 12px rgba(0, 0, 0, .12);
    box-sizing: border-box;
    border: 1px solid #e4e7ed;
}

.image-item-header {
    padding: 0 2px 0 7px;
}

.image-item-header-left {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.image-item-header-right {
    display: flex;
    align-items: center;
}

.image-item-body {
    padding: 10px 10%;
    text-align: center;
}

.image-item-body img {
    /*box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);*/
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.group-item {
    font-size: 16px;
    height: 40px;
    line-height: 40px;
    cursor: pointer;
    padding: 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.group-item:hover {
    background-color: #EAEAEA;
}

.group-item-selected, .group-item-selected:hover {
    background-color: #D7D7D7;
}

.overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 999; /* 确保上下文菜单在遮罩层在之上 */
}

.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: white;
    z-index: 100;
}

.ghost {
    border-bottom: 2px solid #597ef7;
}

/* 批量操作虚拟列表样式 */
.batch-list-container {
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    overflow: hidden;
}

.batch-list-header {
    display: flex;
    align-items: center;
    height: 40px;
    background-color: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;
    font-weight: 500;
    color: #606266;
    font-size: 14px;
}

.batch-list-cell {
    display: flex;
    align-items: center;
    padding: 0 8px;
}

.batch-list-cell-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
}

.batch-scroller {
    height: calc(80vh - 200px);
    background-color: white;
}

.batch-list-row {
    display: flex;
    align-items: center;
    height: 40px;
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.2s;
    font-size: 14px;
    color: #606266;
}

.batch-list-row:hover {
    background-color: #f5f7fa;
}

.batch-list-row.selected {
    background-color: #ecf5ff;
}

/* 批量编辑图片名称虚拟列表样式 */
.batch-edit-container {
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    overflow: hidden;
}

.batch-edit-scroller {
    height: calc(70vh - 180px);
    background-color: white;
    padding: 8px;
}

.batch-edit-item {
    margin-bottom: 8px;
}
</style>