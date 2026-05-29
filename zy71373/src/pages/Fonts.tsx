import { useState, useEffect } from 'react';
import { Search, CheckCircle, FileText, Eye, Type, Calendar, User, Hash } from 'lucide-react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import type { FontFile, EntityStatus } from '../types';

export default function Fonts() {
  const { fonts, licenses, loadFonts, loadLicenses, updateFontStatus, loading } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFonts();
    loadLicenses();
  }, [loadFonts, loadLicenses]);

  const totalFonts = fonts.length;
  const confirmedCount = fonts.filter(f => f.status === 'confirmed').length;
  const tempNoteCount = fonts.filter(f => f.status === 'temp_note').length;

  const filteredFonts = fonts.filter(font =>
    font.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    font.familyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    font.aliases.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleStatusToggle = (font: FontFile) => {
    const newStatus: EntityStatus = font.status === 'confirmed' ? 'temp_note' : 'confirmed';
    updateFontStatus(font.id, newStatus);
  };

  const handleMarkConfirmed = (id: string) => {
    updateFontStatus(id, 'confirmed');
  };

  const handleMarkTempNote = (id: string) => {
    updateFontStatus(id, 'temp_note');
  };

  const handleViewLicense = (fontId: string) => {
    const license = licenses.find(l => l.fontId === fontId);
    alert(license 
      ? `授权证书：${license.licenseType}\n授权方：${license.licensor}\n有效期：${license.startDate} 至 ${license.endDate}`
      : '该字体暂无授权记录'
    );
  };

  const stats = [
    { label: '总字体数', value: totalFonts, icon: Type, color: 'from-cyan-400 to-blue-500' },
    { label: '已确认', value: confirmedCount, icon: CheckCircle, color: 'from-green-400 to-emerald-500' },
    { label: '临时备注', value: tempNoteCount, icon: FileText, color: 'from-amber-400 to-orange-500' },
  ];

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0F2B4A' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">字体库管理</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} hover>
              <CardContent className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索字体名称、字族或别名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading.fonts ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-cyan-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : filteredFonts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Type className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无匹配的字体</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">字体名称</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">字重</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">版本</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">上传日期</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">上传者</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">状态</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">别名</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFonts.map((font) => (
                      <tr key={font.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="py-4 px-4">
                          <span className="font-medium text-white">{font.name}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Hash className="w-4 h-4 text-slate-500" />
                            {font.weight}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-300">{font.version}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            {font.uploadDate}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <User className="w-4 h-4 text-slate-500" />
                            {font.uploader}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <button onClick={() => handleStatusToggle(font)} className="cursor-pointer transition-transform hover:scale-105">
                            <StatusBadge status={font.status} size="sm" />
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            {font.aliases.map((alias, idx) => (
                              <span key={idx} className="px-2 py-0.5 text-xs bg-slate-700/50 text-slate-300 rounded-md border border-slate-600/50">
                                {alias}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {font.status === 'temp_note' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkConfirmed(font.id)}
                                className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              >
                                <CheckCircle className="w-4 h-4" />
                                确认
                              </Button>
                            )}
                            {font.status === 'confirmed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkTempNote(font.id)}
                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              >
                                <FileText className="w-4 h-4" />
                                备注
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewLicense(font.id)}
                              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                            >
                              <Eye className="w-4 h-4" />
                              授权
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
