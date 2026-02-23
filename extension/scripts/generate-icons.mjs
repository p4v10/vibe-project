import sharp from 'sharp'
import { readFileSync } from 'fs'
import { mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const svg = readFileSync(join(rootDir, 'icon.svg'))
await mkdir(join(rootDir, 'images'), { recursive: true })

for (const size of [16, 48, 128]) {
  await sharp(svg).resize(size, size).png().toFile(join(rootDir, 'images', `icon${size}.png`))
  console.log(`✓ images/icon${size}.png`)
}
