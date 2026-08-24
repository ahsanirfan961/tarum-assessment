import TopNav from "@/components/nav/TopNav";

export default function WorkspaceLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      {children}
    </div>
  );
}
