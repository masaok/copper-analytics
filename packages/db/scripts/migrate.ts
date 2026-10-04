import { migrate } from '../src/node'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. See .env.example.')
  process.exit(1)
}
const applied = await migrate(url)
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply.')
