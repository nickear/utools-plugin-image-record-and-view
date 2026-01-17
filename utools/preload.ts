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

// 文件名验证结果
interface FileNameValidation {
    valid: boolean
    error?: string
}

let imagesDir = ''

// 全局变量：追踪正在保存的配置文件，避免并发写入冲突
const savingProfiles = new Map<string, Promise<void>>()

// 验证文件名是否合法（根据当前系统独立判断）
const validateFileName = (name: string): FileNameValidation => {
    // 空名称（所有系统）
    if (!name || name.trim() === '') {
        return { valid: false, error: '名称不能为空' }
    }

    // 禁止 . 和 .. 作为文件名（所有系统）
    if (name === '.' || name === '..') {
        return { valid: false, error: '名称不能是 . 或 ..' }
    }

    // 禁止空字符（所有系统）
    if (name.includes('\x00')) {
        return { valid: false, error: '名称不能包含空字符' }
    }

    const isWindows = process.platform === 'win32'
    const isMacOS = process.platform === 'darwin'
    // const isLinux = process.platform === 'linux'

    if (isWindows) {
        // Windows 特有限制

        // 长度限制（Windows 最大 255）
        if (name.length > 200) {
            return { valid: false, error: '名称不能超过200个字符' }
        }

        // Windows 禁止的字符: \ / : * ? " < > |
        const windowsInvalidChars = /[\\/:*?"<>|]/
        if (windowsInvalidChars.test(name)) {
            return {
                valid: false,
                error: '名称不能包含 \\ / : * ? " < > | 等特殊字符'
            }
        }

        // Windows 禁止以空格或点结尾
        if (/[. ]$/.test(name)) {
            return { valid: false, error: '名称不能以空格或点结尾' }
        }

        // Windows 保留名称（不区分大小写）
        const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
        if (reservedNames.test(name)) {
            return {
                valid: false,
                error: '名称不能使用系统保留名称（如 CON、PRN、AUX 等）'
            }
        }
    } else if (isMacOS) {
        // macOS 特有限制

        // macOS 文件名最大 255 字节（UTF-8）
        if (Buffer.byteLength(name, 'utf8') > 255) {
            return { valid: false, error: '名称过长' }
        }

        // macOS 禁止的字符: / 和 :
        // 注意：macOS 的 HFS+ 和 APFS 文件系统中 : 会被转换为 /
        if (/[/:]/.test(name)) {
            return { valid: false, error: '名称不能包含 / 或 : 字符' }
        }
    } else {
        // Linux 特有限制

        // Linux 文件名最大 255 字节（UTF-8）
        if (Buffer.byteLength(name, 'utf8') > 255) {
            return { valid: false, error: '名称过长' }
        }

        // Linux 只禁止 /
        if (name.includes('/')) {
            return { valid: false, error: '名称不能包含 / 字符' }
        }
    }

    return { valid: true }
}

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

const createNewGroup = (
    group: string
): { success: boolean; error?: string } => {
    // 验证分组名称
    const validation = validateFileName(group)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    const groupPath = getGroupPath(group)

    try {
        // 检查是否已存在
        if (fs.existsSync(groupPath)) {
            return { success: false, error: '分组已存在' }
        }

        fs.mkdirSync(groupPath)
        return { success: true }
    } catch (e: any) {
        console.error('createNewGroup error:', e)
        return { success: false, error: '创建分组失败，请重试' }
    }
}

const renameGroup = (
    _old: string,
    _new: string
): { success: boolean; error?: string } => {
    // 验证新分组名称
    const validation = validateFileName(_new)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    const oldPath = getGroupPath(_old)
    const newPath = getGroupPath(_new)

    try {
        // 检查原分组是否存在
        if (!fs.existsSync(oldPath)) {
            return { success: false, error: '原分组不存在' }
        }

        // 检查目标分组是否已存在
        if (fs.existsSync(newPath)) {
            return { success: false, error: '目标分组名已存在' }
        }

        fs.renameSync(oldPath, newPath)
        return { success: true }
    } catch (e: any) {
        console.error('renameGroup error:', e)
        return { success: false, error: '重命名失败，请重试' }
    }
}

const getGroupListAndProfile = (): { list: string[]; profile: GroupProfile } => {
    const defaultProfile: GroupProfile = {
        groupsOrder: [],
        lastOpenedGroup: '',
        imageNumPerRow: 1
    }

    try {
        // 使用 withFileTypes 选项，一次性获取文件类型，无需额外 stat 调用
        const entries = fs.readdirSync(imagesDir, { withFileTypes: true })

        if (entries.length === 0) {
            return { list: [], profile: defaultProfile }
        }

        // 直接过滤出目录
        const list = entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)

        try {
            const profile = JSON.parse(
                fs.readFileSync(getGroupProfilePath(), 'utf8')
            ) as GroupProfile
            list.sort(
                (a: string, b: string) =>
                    profile.groupsOrder.indexOf(a) - profile.groupsOrder.indexOf(b)
            )
            return { list, profile }
        } catch (e) {
            // 配置文件不存在或解析失败，使用默认配置
            return { list, profile: defaultProfile }
        }
    } catch (e) {
        // 目录读取失败，返回空列表
        return { list: [], profile: defaultProfile }
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

const checkImageProfile = (profileStr: string): ImageProfile => {
    const profile = JSON.parse(profileStr)
    if (!profile || typeof profile !== 'object') {
        throw new Error()
    }
    if (!profile.imagesOrder || !Array.isArray(profile.imagesOrder) ||
        profile.imagesOrder.some((item: any) => typeof item !== 'string')) {
        profile.imagesOrder = []
    }
    if (!profile.imageNumPerRow || typeof profile.imageNumPerRow !== 'number' || profile.imageNumPerRow < 0) {
        profile.imageNumPerRow = 0
    }
    return profile
}

const getImageListAndProfile = async (group: string): Promise<{ list: string[], profile: ImageProfile }> => {
    let list: string[] = []
    let profile: ImageProfile = {
        imagesOrder: [],
        imageNumPerRow: 0
    }
    
    try {
        // 使用 withFileTypes 选项，一次性获取文件类型，无需额外 stat 调用
        const entries = await fsp.readdir(getGroupPath(group), { withFileTypes: true })
        
        if (entries.length !== 0) {
            // 直接过滤：是文件 && 是支持的图片格式
            list = entries
                .filter(entry => entry.isFile() && isSupportImage(entry.name))
                .map(entry => entry.name)
            
            // 并行读取配置文件
            try {
                profile = checkImageProfile(await fsp.readFile(getImageProfilePath(group), 'utf8'))
                list.sort((a: string, b: string) => profile.imagesOrder.indexOf(a) - profile.imagesOrder.indexOf(b))
            } catch (e) {
                // 配置文件不存在或解析失败，使用默认配置
            }
        }
    } catch (e) {
        // 目录读取失败，返回空列表
    }
    
    return { list, profile }
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
    let i = 2
    let image = `剪贴板上传图片${currentTimeFormat()}${extension}`
    let targetPath = getImagePath(group, image)
    const buffer = Buffer.from(arrayBuffer)
    
    // 使用原子操作，确保绝对安全
    while (true) {
        try {
            // flag: 'wx' - 如果文件存在则失败（原子操作）
            // 等价于 copyFile 中的 COPYFILE_EXCL
            await fsp.writeFile(targetPath, buffer, { flag: 'wx' })
            return image  // 成功
        } catch (e: any) {
            if (e.code === 'EEXIST') {
                // 文件已存在（时间戳冲突或外部创建），改名重试
                const timestamp = currentTimeFormat()
                image = `剪贴板上传图片${timestamp}（${i++}）${extension}`
                targetPath = getImagePath(group, image)
                continue
            }
            // 其他错误（如权限问题、磁盘空间不足等）
            console.error('savePureImage error:', e)
            return ''
        }
    }
}

const saveBase64Image = async (group: string, imgBase64: string) => {
    let i = 2
    let image = `截图上传图片${currentTimeFormat()}.png`
    let targetPath = getImagePath(group, image)
    
    // 移除 data URL 前缀，支持所有图片格式（包括 svg+xml）
    const base64Data = imgBase64.replace(/^data:image\/[^;]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    
    // 使用原子操作，确保绝对安全
    while (true) {
        try {
            // flag: 'wx' - 如果文件存在则失败（原子操作）
            // 等价于 copyFile 中的 COPYFILE_EXCL
            await fsp.writeFile(targetPath, buffer, { flag: 'wx' })
            return image  // 成功
        } catch (e: any) {
            if (e.code === 'EEXIST') {
                // 文件已存在（时间戳冲突或外部创建），改名重试
                const timestamp = currentTimeFormat()
                image = `截图上传图片${timestamp}（${i++}）.png`
                targetPath = getImagePath(group, image)
                continue
            }
            // 其他错误（如权限问题、磁盘空间不足等）
            console.error('saveBase64Image error:', e)
            return ''
        }
    }
}

const copyImage = async (srcPath: string, group: string) => {
    let i = 2
    const {base, name, ext} = path.parse(srcPath)
    let image = base
    let targetPath = getImagePath(group, image)
    
    // 使用文件系统的原子操作，确保绝对安全
    while (true) {
        try {
            // COPYFILE_EXCL: 如果目标文件已存在，操作将失败
            // 这是文件系统级别的原子操作，100% 安全
            await fsp.copyFile(srcPath, targetPath, fs.constants.COPYFILE_EXCL)
            return image  // 成功复制
        } catch (e: any) {
            if (e.code === 'EEXIST') {
                // 文件已存在，改名后重试
                image = `${name}（${i++}）${ext}`
                targetPath = getImagePath(group, image)
                continue
            }
            // 其他错误（如权限问题、磁盘空间不足等）
            console.error('copyImage error:', e)
            return ''
        }
    }
}

const renameImage = async (group: string, _old: string, _new: string): Promise<{ success: boolean; error?: string }> => {
    // 验证新文件名
    const validation = validateFileName(_new)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }
    
    const oldPath = getImagePath(group, _old)
    const newPath = getImagePath(group, _new)
    
    try {
        // 检查目标文件是否已存在（防止外部创建的同名文件）
        try {
            await fsp.access(newPath)
            // 如果能访问，说明文件已存在
            return { success: false, error: '目标文件名已存在' }
        } catch {
            // 文件不存在，可以继续
        }
        
        await fsp.rename(oldPath, newPath)
        return { success: true }
    } catch (e: any) {
        if (e.code === 'ENOENT') {
            return { success: false, error: '原文件不存在' }
        }
        if (e.code === 'EEXIST') {
            return { success: false, error: '目标文件名已存在' }
        }
        console.error('renameImage error:', e)
        return { success: false, error: '重命名失败，请重试' }
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
    const profilePath = getGroupProfilePath()
    
    // 如果已经有保存任务在进行，将新的保存任务链接到现有任务后面
    const existingTask = savingProfiles.get(profilePath)
    
    const saveTask = (existingTask || Promise.resolve()).then(() => {
        // 执行实际的保存操作
        fs.writeFileSync(profilePath, JSON.stringify(profile), 'utf8')
    }).finally(() => {
        // 只有当前任务是 Map 中的任务时才删除
        if (savingProfiles.get(profilePath) === saveTask) {
            savingProfiles.delete(profilePath)
        }
    })
    
    savingProfiles.set(profilePath, saveTask)
}

const saveImageProfile = (group: string, profile: ImageProfile) => {
    const profilePath = getImageProfilePath(group)
    
    // 如果已经有保存任务在进行，将新的保存任务链接到现有任务后面
    const existingTask = savingProfiles.get(profilePath)
    
    const saveTask = (existingTask || Promise.resolve()).then(() => {
        // 执行实际的保存操作
        fs.writeFileSync(profilePath, JSON.stringify(profile), 'utf8')
    }).finally(() => {
        // 只有当前任务是 Map 中的任务时才删除
        if (savingProfiles.get(profilePath) === saveTask) {
            savingProfiles.delete(profilePath)
        }
    })
    
    savingProfiles.set(profilePath, saveTask)
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
    saveImageProfile,
    validateFileName
}