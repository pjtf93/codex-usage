import { createCLI } from './cli/commands.js';

async function main() {
  const program = createCLI();
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
