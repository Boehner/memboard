export default function Footer() {
  return (
  <footer className="mt-12 text-sm text-gray-500">
    Built for the <a href="https://memoryproto.co/" target="_blank"
      className="text-blue-400 hover:text-blue-300">Memory Protocol Builder Rewards</a> • © {new Date().getFullYear()} MemBoard
    <span className="mx-2">•</span>
    <a href="/terms.html" className="text-blue-400 hover:text-blue-300">Terms &amp; Conditions</a>
  </footer>
  );
}