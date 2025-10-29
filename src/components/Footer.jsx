export default function Footer() {
  return (
  <footer className="mt-12 text-sm text-gray-500">
    Built for the <a href="https://memory.build" target="_blank"
      className="text-blue-400 hover:text-blue-300">Memory Protocol Builder Rewards</a> • © {new Date().getFullYear()} MemBoard
  </footer>
  );
}