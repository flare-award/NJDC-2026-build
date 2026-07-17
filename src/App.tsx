import { HashRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "./context/DataContext";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import Bracket from "./pages/Bracket";
import Matches from "./pages/Matches";
import MatchDetail from "./pages/MatchDetail";
import Leaderboard from "./pages/Leaderboard";
import AdminPage from "./pages/admin/AdminPage";

function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white antialiased">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<SiteLayout><Home /></SiteLayout>} />
            <Route path="/teams" element={<SiteLayout><Teams /></SiteLayout>} />
            <Route path="/teams/:id" element={<SiteLayout><TeamDetail /></SiteLayout>} />
            <Route path="/bracket" element={<SiteLayout><Bracket /></SiteLayout>} />
            <Route path="/matches" element={<SiteLayout><Matches /></SiteLayout>} />
            <Route path="/matches/:id" element={<SiteLayout><MatchDetail /></SiteLayout>} />
            <Route path="/leaderboard" element={<SiteLayout><Leaderboard /></SiteLayout>} />
            <Route
              path="/nb-admin-9991"
              element={
                <div className="min-h-screen bg-[#0d0d0d] text-white antialiased">
                  <AdminPage />
                </div>
              }
            />
            <Route path="*" element={<SiteLayout><Home /></SiteLayout>} />
          </Routes>
        </HashRouter>
      </DataProvider>
    </AuthProvider>
  );
}
