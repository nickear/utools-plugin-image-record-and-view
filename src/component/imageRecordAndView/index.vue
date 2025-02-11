<script setup lang="ts">
import {ref, watchEffect, onMounted, computed} from 'vue'
import {ElMessage, ElMessageBox} from "element-plus";
import ContextMenu from '@/component/contextMenu/index.vue'
import draggable from 'vuedraggable'
import {ElMessageBoxOptions} from "element-plus/es/components/message-box/src/message-box.type";
import SvgIcon from '@/component/svgIcon/index.vue'

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
const batchEditImages = ref<{name: string, extension: string, tipsVisible: boolean}[]>([])
const imageLoadList: boolean[] = [] // 图片加载状态列表,true表示图片已加载完成,false表示图片未加载
let scrollToImageIndex: number = -1 // 要滚动到的图片的索引
const imageBatchEditDialogVisible = ref<boolean>(false)

const supportImageMIME = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/bmp', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']

const imageNumPerRow = computed(() => {
    return groupImageNumPerRow.value || globalImageNumPerRow.value || 1
})

const handleGroupDialogConfirmBtnClick = () => {
    groupName.value = groupName.value.trim()
    let message = ''
    if (!groupName.value) {
        message = '分组名称不能为空'
    } else if (groupName.value.length > 100) {
        message = '修改失败，分组名称不能超过100个字符'
    } else {
        const index = groupList.value.indexOf(groupName.value)
        if (index !== -1 && (isGroupAdd.value || index !== groupIndex.value)) {
            message = '分组名称重复'
        }
    }
    if (message) {
        ElMessage.warning({
            message,
            showClose: true
        })
        return
    }
    if (isGroupAdd.value) {
        window.p.createNewGroup(groupName.value)
        groupList.value.push(groupName.value)
        handleGroupChange(groupName.value, true)
    } else {
        window.p.renameGroup(groupList.value[groupIndex.value], groupName.value)
        featureCodes.value.forEach((featureCode: string, index: number) => {
            if (featureCode.startsWith(`${groupList.value[groupIndex.value]}/`)) {
                utools.removeFeature(featureCode)
                const image = featureCode.slice(featureCode.indexOf('/') + 1)
                const newFeatureCode = `${groupName.value}/${image}`
                utools.setFeature({
                    "code": newFeatureCode,
                    "explain": image,
                    "platform": ["win32", "darwin", "linux"],
                    "cmds": [image]
                })
                featureCodes.value[index] = newFeatureCode
            }
        })
        if (openedGroup.value === groupList.value[groupIndex.value]) {
            openedGroup.value = groupName.value
        }
        groupList.value[groupIndex.value] = groupName.value
        saveGroupProfile()
    }
    groupDialogVisible.value = false
}

const handleGroupChange = async (group: string, isNewGroup?: boolean) => {
    imageList.value = []
    openedGroup.value = group
    if (isNewGroup) {
        groupImageNumPerRow.value = 0
    } else {
        loading.value = true
        const {list, profile} = await window.p.getImageListAndProfile(group)
        loading.value = false
        imageList.value = list
        groupImageNumPerRow.value = profile.imageNumPerRow || 0
    }
    saveGroupProfile()
}

const saveImageHandler = async (saveImageFn: (listItem?: any) => Promise<string>, list?: any[]) => {
    loading.value = true
    if (list) {
        let successCount = 0
        for (let i = list.length - 1; i >= 0; i--) {
            const image = await saveImageFn(list[i])
            if (image) {
                successCount++
                imageList.value.unshift(image)
            }
        }
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
        // 如果复制的是图片文件
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
        // 如果复制的是纯图片
        navigator.clipboard.read().then(async (clipboards) => {
            const list: { arrayBuffer: ArrayBuffer, extension: string }[] = []
            for (const clipboard of clipboards) {
                let imageType = clipboard.types.find(type => supportImageMIME.includes(type))
                if (imageType) {
                    const blob = await clipboard.getType(imageType)
                    const arrayBuffer = await blob.arrayBuffer();
                    list.push({
                        arrayBuffer,
                        extension: convertMIMEToExtension(imageType)
                    })
                }
            }
            if (!list.length) {
                ElMessage.warning({
                    message: '上传失败，剪贴板中未读取到图片，或图片格式不支持',
                    showClose: true
                })
            } else {
                saveImageHandler(({
                                      arrayBuffer,
                                      extension
                                  }) => window.p.savePureImage(openedGroup.value, arrayBuffer, extension), list)
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
        batchEditImages.value = selectedImages.value.map((image: string) => ({
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
    batchOperateHandler(() => {
        return utools.copyFile(selectedImages.value.map((image: string) => getImagePath(image)))
    }, {allInOne: true})
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
    batchOperateHandler(() => {
        return utools.hideMainWindowPasteFile(selectedImages.value.map((image: string) => getImagePath(image)))
    }, {allInOne: true, showMessage: false})
}

const handleKeywordBatchSetBtnClick = () => {
    batchOperateHandler((image: string) => {
        const featureCode = `${openedGroup.value}/${image}`
        if (!featureCodes.value.includes(featureCode)) {
            if (utools.setFeature({
                "code": featureCode,
                "explain": image,
                "platform": ["win32", "darwin", "linux"],
                "cmds": [image]
            })) {
                featureCodes.value.push(featureCode)
                return true
            }
            return false
        }
        return true
    }, {allInOne: false})
}

const handleKeywordBatchRemoveBtnClick = () => {
    batchOperateHandler((image: string) => {
        const featureCode = `${openedGroup.value}/${image}`
        if (featureCodes.value.includes(featureCode)) {
            if (utools.removeFeature(featureCode)) {
                featureCodes.value = featureCodes.value.filter((_featureCode: string) => _featureCode !== featureCode)
                return true
            }
            return false
        }
        return true
    }, {allInOne: false})
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
            saveImageProfile()
        })
}

const handleImageBatchRemoveBtnClick = () => {
    if (selectedImages.value.length === 0) {
        ElMessage.warning({
            message: '未选中图片',
            showClose: true
        })
    } else {
        ElMessageBox.confirm(
            `确定删除选中的所有图片？图片删除后将无法恢复！！！`,
            '提示',
            {
                confirmButtonText: '确定删除',
                confirmButtonClass: 'el-button--danger',
                cancelButtonText: '取消',
                type: 'warning',
            } as ElMessageBoxOptions
        )
            .then(async () => {
                await batchOperateHandler(async (image: string) => {
                    const success = await window.p.removeImage(openedGroup.value, image)
                    if (success) {
                        const featureCode = `${openedGroup.value}/${image}`
                        if (featureCodes.value.includes(featureCode)) {
                            if (utools.removeFeature(featureCode)) {
                                featureCodes.value = featureCodes.value.filter((_featureCode: string) => _featureCode !== featureCode)
                            }
                        }
                        imageList.value.splice(imageList.value.indexOf(image), 1)
                        return true
                    }
                    return false
                }, {allInOne: false})
                saveImageProfile()
            })
    }
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
    debugger;
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
    const pattern = /[\\/:*?"<>|]/g
    if (pattern.test(val)) {
        tipsVisible.value = true
        groupName.value = val.replace(pattern, '')
    } else {
        tipsVisible.value = false
    }
}

const handleImageInput = (val: string) => {
    const pattern = /[\\/:*?"<>|]/g
    if (pattern.test(val)) {
        tipsVisible.value = true
        imageName.value = val.replace(pattern, '')
    } else {
        tipsVisible.value = false
    }
}

const handleBatchImageInput = (val: string, image: {name: string, extension: string, tipsVisible: boolean}) => {
    const pattern = /[\\/:*?"<>|]/g
    if (pattern.test(val)) {
        image.tipsVisible = true
        image.name = val.replace(pattern, '')
    } else {
        image.tipsVisible = false
    }
}

const handleImageBatchEditConfirmBtnClick = async () => {
    batchEditImages.value.forEach(image => {
        image.name = image.name.trim()
    })
    imageList.value.map(image => {
        let index = selectedImages.value.indexOf(image)
        if (index !== -1) {
            return batchEditImages.value[index]
        }
    })
    await batchOperateHandler((image, index) => {
        console.log(`${image} to ${batchEditImages.value[index].name + batchEditImages.value[index].extension }`)
        return true
    }, {allInOne: false})
    // imageBatchEditDialogVisible.value = false
}

const getImagePath = (image: string) => {
    return window.p.getImagePath(openedGroup.value, image)
}

const handleImageLoad = (index: number) => {
    if (scrollToImageIndex !== -1) {
        imageLoadList[index] = true
        let arePreviousImagesLoaded = true
        for (let i = 0; i < scrollToImageIndex; i++) {
            if (!imageLoadList[i]) {
                arePreviousImagesLoaded = false
                break
            }
        }
        if (arePreviousImagesLoaded) {
            document.querySelector(`.image-item:nth-child(${scrollToImageIndex + 1})`).scrollIntoView()
            scrollToImageIndex = -1
            imageLoadList.length = 0
        }
    }
}

const handleImageDialogConfirmBtnClick = () => {
    imageName.value = imageName.value.trim()
    let message = ''
    if (!imageName.value) {
        message = '修改失败，图片名称不能为空'
    } else if (imageName.value.length > 100) {
        message = '修改失败，图片名称不能超过100个字符'
    } else if (![-1, imageIndex.value].includes(imageList.value.indexOf(`${imageName.value}${imageExtension.value}`))) {
        message = '修改失败，图片名称重复'
    }
    if (message) {
        ElMessage.warning({
            message,
            showClose: true
        })
        return
    }
    const originalImage = imageList.value[imageIndex.value]
    const newImage = `${imageName.value}${imageExtension.value}`
    window.p.renameImage(openedGroup.value, originalImage, newImage)
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
            message: '由于名称变化，关键字已更新',
            showClose: true
        })
    }
    imageList.value[imageIndex.value] = newImage
    saveImageProfile()
    imageDialogVisible.value = false
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
  if (event.dataTransfer?.files?.length) {
    const images = [...event.dataTransfer.files].filter((file: File) => supportImageMIME.includes(file.type))
    if (images && images.length) {
      saveImageHandler((path) => window.p.copyImage(path, openedGroup.value), images.map((image: File) => image.path))
    }
  }
}

onMounted(() => {
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
            handleGroupChange(group)
            const index = imageList.value.indexOf(image)
            if (index === -1) {
                ElMessage.warning({
                    message: '该图片不存在',
                    showClose: true
                })
            } else {
                fullscreenImage.value = image
                fullscreenVisible.value = true
                scrollToImageIndex = index
            }
        }
    }

    utools.setSubInput(({text}: any) => {
        search.value = text
    })
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
                            :width="260"
                            content='名称不能包含\/:*?"<>|中的任何字符'
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
                            共{{ imageList.length }}张图片
                        </div>
                    </div>
                </div>
                <div v-if="imageList.length" class="image-list" @drop="handleDrop" @dragover.prevent>
                    <div class="image-item"
                         :style="{width: `calc((100% - ${(imageNumPerRow-1)*20}px) / ${imageNumPerRow})`}"
                         v-for="(image,index) in imageList" :key="image">
                        <div class="header image-item-header">
                            <div class="image-item-header-left" :title="image">{{ image }}</div>
                            <div class="image-item-header-right">
                                <div v-if="imageNumPerRow===1" class="header-btn square" title="修改图片名称"
                                     @click="handleImageEditBtnClick(image, index)">
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
                                     @click="handleImageRemoveBtnClick(image, index)">
                                    <SvgIcon name="delete"></SvgIcon>
                                </div>
                                <div v-if="imageNumPerRow>=2" class="header-btn square" title="更多"
                                     @click="showImageContextMenu($event, image, index, true)">
                                    <SvgIcon name="more"></SvgIcon>
                                </div>
                            </div>
                        </div>
                        <div class="image-item-body">
                            <img style="max-width: 100%" :src="getImagePath(image)" :title="image"
                                 @contextmenu="showImageContextMenu($event, image, index)"
                                 @load="handleImageLoad(index)">
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
                    :width="260"
                    content='名称不能包含\/:*?"<>|中的任何字符'
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
        >
            <el-button style="margin: 0 8px 8px 0" color="#626aef" @click="handleImageBatchEditBtnClick">修改图片名称
            </el-button>
            <el-button style="margin: 0 8px 8px 0" color="#626aef" @click="handleKeywordBatchSetBtnClick">设为utools关键字
            </el-button>
            <el-button style="margin: 0 8px 8px 0" color="#626aef" @click="handleKeywordBatchRemoveBtnClick">移除utools关键字
            </el-button>
            <el-button style="margin: 0 8px 8px 0" color="#626aef" @click="handleImageFileBatchCopyBtnClick">
                复制图片文件
            </el-button>
            <el-button style="margin: 0 8px 8px 0" color="#626aef" @click="handleImageFileBatchPasteBtnClick">粘贴图片文件
            </el-button>
            <el-button style="margin: 0 8px 8px 0" type="danger" @click="handleImageBatchRemoveBtnClick">删除
            </el-button>
            <el-table :data="imageList" max-height="calc(80vh - 152px)"
                      @selection-change="(rows: string[]) => selectedImages = rows">
                <el-table-column type="selection" width="38"></el-table-column>
                <el-table-column width="48">
                    <template #default="{row}">
                        <div style="display: flex; align-items: center"
                             :title="featureCodes.includes(`${openedGroup}/${row}`) ? '已设为关键字' : '未设为关键字'">
                            <SvgIcon
                                    :name="featureCodes.includes(`${openedGroup}/${row}`) ? 'star-fill' : 'star'"></SvgIcon>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column width="48">
                    <template #default="{row}">
                        <el-popover :popper-style="{width: 'auto', minWidth: 0, padding: 0}"
                                    placement="right">
                            <template #reference>
                                <div style="display: flex; align-items: center; cursor: pointer">
                                    <SvgIcon name="view"></SvgIcon>
                                </div>
                            </template>
                            <img :src="getImagePath(row)" style="max-width: 300px; display: block">
                        </el-popover>
                    </template>
                </el-table-column>
                <el-table-column label="图片名称">
                    <template #default="{row}">{{ row }}</template>
                </el-table-column>
            </el-table>
        </el-dialog>
        <el-dialog
            v-model="imageBatchEditDialogVisible"
            title="批量修改图片名称"
            width="400"
        >
            <el-scrollbar max-height="calc(70vh - 120px)">
                <div v-for="(image,index) in batchEditImages" :key="index" style="margin-top: 6px">
                    <el-popover
                        :visible="image.tipsVisible"
                        placement="bottom"
                        :width="260"
                        content='名称不能包含\/:*?"<>|中的任何字符'
                    >
                        <template #reference>
                            <el-input
                                v-model="image.name"
                                placeholder="输入图片名称"
                                @input="val => {handleBatchImageInput(val, image)}"
                                @blur="image.tipsVisible=false">
                                <template #append>{{ image.extension }}</template>
                            </el-input>
                        </template>
                    </el-popover>
                </div>
            </el-scrollbar>
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
</style>