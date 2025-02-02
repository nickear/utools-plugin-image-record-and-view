// 您可以在进行窗口交互
// utools文档

// https://www.u.tools/docs/developer/api.html#%E7%AA%97%E5%8F%A3%E4%BA%A4%E4%BA%92
import * as fs from "fs";
import * as path from "path";
import * as fsp from 'fs/promises'

interface GroupProfile {
    lastOpenedGroup: string; // 最后打开的分组
    groupsOrder: string[]; // 分组的顺序
    imageNumPerRow: number // 每行展示的图片数量（全局）
}

interface ImageProfile {
    imagesOrder: string[] // 图片的顺序
    imageNumPerRow: number // 每行展示的图片数量（分组）
}

let imagesDir = ''

const setImagesDir = (_imagesDir: string) => {
    imagesDir = _imagesDir
}

const getImagesDir = () => {
    return imagesDir
}

const isImagesDirExist = () => {
    return fs.existsSync(imagesDir)
}

const getGroupPath = (group: string) => {
    return path.join(imagesDir, group)
}

const getImagePath = (group: string, image: string) => {
    return path.join(imagesDir, group, image)
}

const getGroupProfilePath = () => {
    return path.join(imagesDir, '插件配置文件（勿改勿删）.json')
}

const getImageProfilePath = (group: string) => {
    return path.join(imagesDir, group, '插件配置文件（勿改勿删）.json')
}

const createNewGroup = (group: string) => {
    fs.mkdirSync(getGroupPath(group))
}

const renameGroup = (_old: string, _new: string) => {
    fs.renameSync(getGroupPath(_old), getGroupPath(_new))
}

const getGroupListAndProfile = (): { list: string[], profile: GroupProfile } => {
    const files = fs.readdirSync(imagesDir)
    const defaultProfile = {
        groupsOrder: [],
        lastOpenedGroup: '',
        imageNumPerRow: 1
    }
    if (files.length === 0) {
        return {
            list: [],
            profile: defaultProfile
        }
    }
    const list = files
        .filter((file: string) => fs.statSync(path.join(imagesDir, file)).isDirectory())
    try {
        const profile = JSON.parse(fs.readFileSync(getGroupProfilePath(), 'utf8')) as GroupProfile
        list.sort((a: string, b: string) => profile.groupsOrder.indexOf(a) - profile.groupsOrder.indexOf(b))
        return {
            list,
            profile
        }
    } catch (e) {
        return {
            list,
            profile: defaultProfile
        }
    }
}

const removeGroup = async (group: string) => {
    try {
        await fsp.rm(getGroupPath(group), {recursive: true})
        return true
    } catch (e) {
        return false
    }
}

const imageExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.bmp', '.webp', '.ico']
const isSupportImage = (file: string) => {
    return imageExtensions.includes(path.extname(file).toLowerCase())
}

const checkImageProfile = (profileStr: string) => {
    const profile = JSON.parse(profileStr)
    if (!profile || typeof profile !== 'object') {
        throw new Error()
    }
    if (!profile.imagesOrder || !Array.isArray(profile.imagesOrder) ||
        profile.imagesOrder.some(item => typeof item !== 'string')) {
        profile.imagesOrder = []
    }
    if (!profile.imageNumPerRow || typeof profile.imageNumPerRow !== 'number' || profile.imageNumPerRow < 0) {
        profile.imageNumPerRow = 0
    }
    return profile
}

const getImageListAndProfile = async (group: string): Promise<{ list: string[], profile: ImageProfile }> => {
    let list = []
    let profile = {
        imagesOrder: [],
        imageNumPerRow: 0
    }
    try {
        const files = await fsp.readdir(getGroupPath(group))
        if (files.length !== 0) {
            for (const file of files) {
                if ((await fsp.stat(path.join(imagesDir, group, file))).isFile() && isSupportImage(file)) {
                    list.push(file)
                }
            }
            profile = checkImageProfile(await fsp.readFile(getImageProfilePath(group), 'utf8'))
            list.sort((a: string, b: string) => profile.imagesOrder.indexOf(a) - profile.imagesOrder.indexOf(b))
        }
    } finally {
        return {
            list,
            profile
        }
    }
}

const currentTimeFormat = () => {
    const currentTime = new Date()
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const day = String(currentTime.getDate()).padStart(2, '0');
    const hours = String(currentTime.getHours()).padStart(2, '0');
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const seconds = String(currentTime.getSeconds()).padStart(2, '0');
    const milliseconds = String(currentTime.getMilliseconds()).padStart(3, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}_${milliseconds}`;
}

const savePureImage = async (group: string, arrayBuffer: Uint8Array, extension: string) => {
    const image = `剪贴板上传图片${currentTimeFormat()}${extension}`
    try {
        await fsp.writeFile(getImagePath(group, image), Buffer.from(arrayBuffer))
        return image
    } catch (e) {
        return ''
    }
}

const saveBase64Image = async (group: string, imgBase64: string) => {
    const image = `截图上传图片${currentTimeFormat()}.png`
    try {
        await fsp.writeFile(getImagePath(group, image), Buffer.from(imgBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64'))
        return image
    } catch (e) {
        return ''
    }
}

const copyImage = async (srcPath: string, group: string) => {
    let i = 2
    const {base, name, ext} = path.parse(srcPath)
    let image = base
    while (true) {
        if (fs.existsSync(getImagePath(group, image))) {
            image = `${name}（${i++}）${ext}`
        } else {
            break
        }
    }
    try {
        await fsp.copyFile(srcPath, getImagePath(group, image))
        return image
    } catch (e) {
        return ''
    }
}

const renameImage = async (group: string, _old: string, _new: string) => {
    try {
        await fsp.rename(getImagePath(group, _old), getImagePath(group, _new))
        return true
    } catch (e) {
        return false
    }
}

const removeImage = async (group: string, image: string) => {
    try {
        await fsp.unlink(getImagePath(group, image))
        return true
    } catch (e) {
        return false
    }
}

const saveGroupProfile = (profile: GroupProfile) => {
    fs.writeFileSync(getGroupProfilePath(), JSON.stringify(profile), 'utf8')
}

const saveImageProfile = (group: string, profile: ImageProfile) => {
    fs.writeFileSync(getImageProfilePath(group), JSON.stringify(profile), 'utf8')
}

window.p = {
    isSupportImage,
    setImagesDir,
    getImagesDir,
    getImageListAndProfile,
    isImagesDirExist,
    getImagePath,
    createNewGroup,
    renameGroup,
    getGroupListAndProfile,
    removeGroup,
    saveBase64Image,
    savePureImage,
    renameImage,
    removeImage,
    copyImage,
    saveGroupProfile,
    saveImageProfile
}