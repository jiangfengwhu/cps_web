"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type Tab = "convert" | "orders";
type ConvertPhase = "input" | "converting" | "success";
type Platform = "jd" | "pdd" | null;

interface Product {
  name: string;
  price?: number | string;
  imgUrl: string;
  commissionRate?: number;
  shopName?: string;
  shopType?: string;
  coupon?: string;
}

interface RecommendItem {
  goodsSign: string;
  name: string;
  imgUrl: string;
  price: string;
  commissionRate: number;
  shopName?: string;
  coupon?: string;
  salesTip?: string;
}

interface ConvertResult {
  clickUrl?: string;
  jCommand?: string;
  schemaUrl?: string;
  hasCommission?: boolean;
  product?: Product;
  recommendations?: RecommendItem[];
}

interface OrderItem {
  orderId: string;
  skuName?: string;
  imgUrl?: string;
  price?: string;
  orderAmount?: string;
  skuNum?: number;
  orderTime?: string;
  statusText?: string;
  userEstimateFee?: number;
  userActualFee?: number;
  platform?: string;
  mallName?: string;
  categoryName?: string;
  failReason?: string;
  error?: string;
}

interface OrdersResult {
  orders: OrderItem[];
  totalEstimateFee: number;
  totalActualFee: number;
}

function detectPlatform(text: string): Platform {
  if (!text) return null;
  const t = text.trim();
  if (t.length > 2000) return null;

  if (/jd\.(com|hk)|3\.cn|u\.jd\.com|jingfen\.jd/i.test(t)) {
    return "jd";
  }
  if (/pinduoduo\.com|yangkeduo\.com|pdd\.com/i.test(t)) {
    return "pdd";
  }
  return null;
}

const platformName: Record<string, string> = {
  jd: "京东",
  pdd: "拼多多",
};

const platformAppName: Record<string, string> = {
  jd: "京东",
  pdd: "拼多多",
};


function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("convert");

  // Convert states
  const [phase, setPhase] = useState<ConvertPhase>("input");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>(null);
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [convertError, setConvertError] = useState("");
  const [statusText, setStatusText] = useState("");
  const autoDetectedRef = useRef(false);

  // Orders states
  const [orderPlatform, setOrderPlatform] = useState<"jd" | "pdd">("pdd");
  const [orderIds, setOrderIds] = useState("");
  const [querying, setQuerying] = useState(false);
  const [ordersResult, setOrdersResult] = useState<OrdersResult | null>(null);
  const [ordersError, setOrdersError] = useState("");

  const doConvert = useCallback(async (targetUrl: string, detectedPlatform?: Platform): Promise<ConvertResult | null> => {
    setConvertError("");
    setConvertResult(null);

    const p = detectedPlatform || detectPlatform(targetUrl);
    if (!p) {
      setConvertError("无法识别商品链接，请粘贴拼多多商品链接");
      return null;
    }
    if (p === "jd") {
      setConvertError("京东暂未开通，敬请期待");
      return null;
    }
    setPlatform(p);

    const apiMap: Record<string, string> = {
      jd: "/api/jd/convert",
      pdd: "/api/pdd/convert",
    };
    const apiPath = apiMap[p];

    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConvertError(data.error || "生成推广链接失败");
        return null;
      }
      setConvertResult(data);
      return data;
    } catch {
      setConvertError("网络错误，请检查网络后重试");
      return null;
    }
  }, []);

  // Auto-detect clipboard on mount (silent, non-blocking)
  useEffect(() => {
    if (autoDetectedRef.current) return;
    autoDetectedRef.current = true;

    const detect = async () => {
      try {
        const text = await navigator.clipboard.readText();
        const trimmed = text?.trim();
        if (!trimmed) return;
        const p = detectPlatform(trimmed);
        if (p) {
          setUrl(trimmed);
          setPlatform(p);
          setStatusText(`发现${platformName[p]}商品链接，正在生成推广链接...`);
          setPhase("converting");
          const result = await doConvert(trimmed, p);
          setPhase(result ? "success" : "input");
        }
      } catch {
        // Clipboard permission denied or not supported
      }
    };

    detect();
  }, [doConvert]);

  const handleManualConvert = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setPhase("converting");
    setStatusText("正在生成推广链接...");
    const result = await doConvert(trimmed);
    setPhase(result ? "success" : "input");
  }, [url, doConvert]);

  const handlePasteAndConvert = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        setUrl(text.trim());
        setPhase("converting");
        setStatusText("正在生成推广链接...");
        const result = await doConvert(text.trim());
        setPhase(result ? "success" : "input");
        return;
      }
    } catch {
      // Permission denied
    }
    setConvertError("无法读取剪切板，请手动粘贴链接");
  }, [doConvert]);

  const handleReset = useCallback(() => {
    setUrl("");
    setPlatform(null);
    setConvertResult(null);
    setConvertError("");
    setPhase("input");
  }, []);

  const openApp = useCallback(() => {
    if (!convertResult) return;

    if (platform === "pdd") {
      if (convertResult.schemaUrl) {
        window.location.href = convertResult.schemaUrl;
      }
      return;
    }

    if (platform === "jd") {
      const webUrl = convertResult.clickUrl;
      if (!webUrl) return;
      const deepLink = "openapp.jdmobile://virtual?params=" + encodeURIComponent(JSON.stringify({ category: "jump", des: "m", url: webUrl }));
      window.location.href = deepLink;
      const fallbackTimer = setTimeout(() => {
        if (!document.hidden) {
          window.location.href = webUrl;
        }
      }, 2000);
      const onHide = () => {
        if (document.hidden) {
          clearTimeout(fallbackTimer);
          document.removeEventListener("visibilitychange", onHide);
        }
      };
      document.addEventListener("visibilitychange", onHide);
    }
  }, [convertResult, platform]);

  const handleQueryOrders = useCallback(async () => {
    const ids = orderIds
      .trim()
      .split(/[\n,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return;

    setQuerying(true);
    setOrdersError("");
    setOrdersResult(null);

    try {
      const apiMap: Record<string, string> = {
        jd: "/api/jd/orders",
        pdd: "/api/pdd/orders",
      };
      const res = await fetch(apiMap[orderPlatform], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrdersError(data.error || "查询失败");
        return;
      }
      setOrdersResult(data);
    } catch {
      setOrdersError("网络错误，请检查网络后重试");
    } finally {
      setQuerying(false);
    }
  }, [orderIds, orderPlatform]);

  // ---- Render ----

  const renderConverting = () => (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Spinner className="h-8 w-8 text-red-500" />
      <p className="text-sm text-gray-500">{statusText}</p>
      {url && (
        <p className="text-xs text-gray-400 max-w-xs truncate px-4">{url}</p>
      )}
    </div>
  );

  const [promotingSign, setPromotingSign] = useState<string | null>(null);

  const handleRecommendClick = useCallback(async (goodsSign: string) => {
    setPromotingSign(goodsSign);
    try {
      const res = await fetch("/api/pdd/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goodsSign }),
      });
      const data = await res.json();
      if (!res.ok || !data.schemaUrl) {
        setConvertError(data.error || "生成推广链接失败");
        return;
      }
      window.location.href = data.schemaUrl;
    } catch {
      setConvertError("网络错误，请重试");
    } finally {
      setPromotingSign(null);
    }
  }, []);

  const renderSuccess = () => {
    const hasCommission = convertResult?.hasCommission ?? false;
    const prod = convertResult?.product;
    const price = prod?.price != null ? Number(prod.price) : 0;
    const rate = prod?.commissionRate ?? 0;
    const coupon = prod?.coupon ? Number(prod.coupon) : 0;
    const finalPrice = coupon > 0 ? Math.max(price - coupon, 0) : price;
    const estimateCommission = rate > 0 && price > 0 ? (finalPrice * rate / 100 * 0.5) : 0;
    const recs = convertResult?.recommendations;

    return (
      <div className="space-y-4">
        {!hasCommission && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">该商品暂无返利</p>
          </div>
        )}

        {prod && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex gap-3">
              {prod.imgUrl && (
                <img src={prod.imgUrl} alt={prod.name} className="w-24 h-24 object-cover rounded-xl flex-shrink-0 bg-gray-100" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{prod.name}</h3>
                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                  {price > 0 && (
                    <span className="text-xl font-bold text-red-500">¥{coupon > 0 ? finalPrice.toFixed(2) : prod.price}</span>
                  )}
                  {coupon > 0 && price > 0 && (
                    <span className="text-xs text-gray-400 line-through">¥{prod.price}</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {coupon > 0 && (
                    <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded-md font-medium">券¥{prod.coupon}</span>
                  )}
                  {prod.shopName && <span className="text-xs text-gray-400">{prod.shopName}</span>}
                </div>
                {hasCommission && estimateCommission > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-xs px-2 py-1 rounded-md font-medium">
                    <span>预估返利</span>
                    <span className="text-sm font-bold">¥{estimateCommission.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {hasCommission ? (
            <button
              onClick={openApp}
              className="w-full text-white py-4 rounded-2xl font-semibold text-base active:opacity-90 transition-opacity shadow-sm bg-gradient-to-r from-red-600 to-red-500 shadow-red-200"
            >
              点击打开拼多多获取返利
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="w-full text-white py-4 rounded-2xl font-semibold text-base active:opacity-90 transition-opacity shadow-sm bg-gray-400"
            >
              换个商品试试
            </button>
          )}
          {hasCommission && (
            <button onClick={handleReset} className="w-full text-gray-400 py-2 text-sm active:text-gray-600 transition-colors">
              转换其他商品
            </button>
          )}
        </div>

        {/* Recommendations */}
        {!hasCommission && recs && recs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3">相似商品推荐（购买可返利）</h4>
            <div className="grid grid-cols-2 gap-3">
              {recs.map((rec) => {
                const rPrice = Number(rec.price);
                const rCoupon = rec.coupon ? Number(rec.coupon) : 0;
                const rFinal = rCoupon > 0 ? Math.max(rPrice - rCoupon, 0) : rPrice;
                const rCommission = rPrice > 0 && rec.commissionRate > 0 ? (rFinal * rec.commissionRate / 100 * 0.5) : 0;

                return (
                  <button
                    key={rec.goodsSign}
                    onClick={() => handleRecommendClick(rec.goodsSign)}
                    disabled={!!promotingSign}
                    className="bg-white rounded-2xl shadow-sm p-3 text-left active:bg-gray-50 transition-colors disabled:opacity-60"
                  >
                    {rec.imgUrl && (
                      <img src={rec.imgUrl} alt={rec.name} className="w-full aspect-square object-cover rounded-xl bg-gray-100 mb-2" />
                    )}
                    <h5 className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug min-h-[2.5em]">{rec.name}</h5>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-red-500">¥{rCoupon > 0 ? rFinal.toFixed(2) : rec.price}</span>
                      {rCoupon > 0 && <span className="text-[10px] text-gray-400 line-through">¥{rec.price}</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {rCoupon > 0 && (
                        <span className="text-[10px] bg-red-50 text-red-500 px-1 py-0.5 rounded font-medium">券¥{rec.coupon}</span>
                      )}
                      {rCommission > 0 && (
                        <span className="text-[10px] bg-orange-50 text-orange-600 px-1 py-0.5 rounded font-medium">
                          返¥{rCommission.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {hasCommission && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-amber-800 mb-2.5">温馨提示</h4>
            <ul className="space-y-2 text-xs text-amber-700 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-amber-400 flex-shrink-0 mt-0.5">●</span>
                <span>最终在<strong>拼多多APP</strong>下单，安全无风险</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 flex-shrink-0 mt-0.5">●</span>
                <span>打开APP后<strong>不要更改商品规格</strong>，否则需要重新生成</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 flex-shrink-0 mt-0.5">●</span>
                <span>需在 <strong>24小时内</strong> 完成下单</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400 flex-shrink-0 mt-0.5">●</span>
                <span>下单 <strong>7天后</strong> 可提现（退款后没有返利）</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderInput = () => (
    <div className="space-y-4">
      {/* Link Input Card */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">商品链接</label>
        <textarea
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="请粘贴拼多多商品链接..."
          className="w-full h-20 px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-all"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleManualConvert();
            }
          }}
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={handlePasteAndConvert}
            className="flex-1 bg-white border border-red-300 text-red-500 py-3 rounded-xl font-medium text-sm active:bg-red-50 transition-colors"
          >
            粘贴并生成
          </button>
          <button
            onClick={handleManualConvert}
            disabled={!url.trim()}
            className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 active:opacity-90 transition-opacity shadow-sm shadow-red-200"
          >
            生成推广链接
          </button>
        </div>
      </div>

      {/* Error */}
      {convertError && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-sm">
          {convertError}
        </div>
      )}

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <h4 className="text-sm font-semibold text-amber-800 mb-2.5">使用说明</h4>
        <ul className="space-y-2 text-xs text-amber-700 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-amber-400 flex-shrink-0 mt-0.5">❶</span>
            <span>在拼多多APP中找到想买的商品，点击右上角分享，选择复制链接</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 flex-shrink-0 mt-0.5">❷</span>
            <span>回到本页面，点击粘贴并生成</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 flex-shrink-0 mt-0.5">❸</span>
            <span>请务必通过该页面的按钮进入拼多多APP下单，否则无法享受返利优惠</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 flex-shrink-0 mt-0.5">❹</span>
            <span>确认收货后可查询返利并提现</span>
          </li>
        </ul>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <h4 className="text-sm font-semibold text-amber-800 mb-2.5">注意事项</h4>
        <ul className="space-y-2 text-xs text-amber-700 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-amber-400 flex-shrink-0 mt-0.5">●</span>
            <span>打开APP后<strong>不要更改商品规格</strong>，否则需重新生成推广链接</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 flex-shrink-0 mt-0.5">●</span>
            <span>需在 <strong>24小时内</strong> 完成下单</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 flex-shrink-0 mt-0.5">●</span>
            <span>退款后返利将被取消</span>
          </li>
        </ul>
      </div>
    </div>
  );

  const renderConvertTab = () => {
    switch (phase) {
      case "converting":
        return renderConverting();
      case "success":
        return renderSuccess();
      case "input":
      default:
        return renderInput();
    }
  };

  const orderPlatformOptions = [
    { key: "pdd" as const, label: "拼多多", disabled: false },
    { key: "jd" as const, label: "京东(即将上线)", disabled: true },
  ];

  const renderOrdersTab = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-4">
        {/* Platform Selector */}
        <label className="block text-sm font-medium text-gray-700 mb-2">选择平台</label>
        <div className="flex gap-2 mb-4">
          {orderPlatformOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { if (!opt.disabled) { setOrderPlatform(opt.key); setOrdersResult(null); setOrdersError(""); } }}
              disabled={opt.disabled}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                opt.disabled
                  ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                  : orderPlatform === opt.key
                  ? "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 active:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-2">订单号</label>
        <textarea
          value={orderIds}
          onChange={(e) => setOrderIds(e.target.value)}
          placeholder={"请输入订单号，每行一个\n支持多个订单同时查询"}
          className="w-full h-32 px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-all"
        />
        <button
          onClick={handleQueryOrders}
          disabled={querying || !orderIds.trim()}
          className="w-full mt-3 bg-gradient-to-r from-red-500 to-orange-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 active:opacity-90 transition-opacity shadow-sm shadow-red-200"
        >
          {querying ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="h-4 w-4" />
              查询中...
            </span>
          ) : (
            "查询提现"
          )}
        </button>
      </div>

      {ordersError && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-sm">
          {ordersError}
        </div>
      )}

      {ordersResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-3 text-center">返利汇总</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">预估返利</p>
                <p className="text-2xl font-bold text-orange-500">¥{ordersResult.totalEstimateFee.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">实际返利</p>
                <p className="text-2xl font-bold text-red-500">¥{ordersResult.totalActualFee.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {ordersResult.orders.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-sm text-gray-400">
              未查询到订单记录
            </div>
          )}
          {ordersResult.orders.map((order, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-sm p-4">
              {order.error ? (
                <div className="text-sm text-red-500">
                  <span className="text-gray-400 text-xs">订单 {order.orderId}</span>
                  <p className="mt-1">{order.error}</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400">订单号: {order.orderId}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        /已完成|已结算|审核成功/.test(order.statusText || "")
                          ? "bg-green-50 text-green-600"
                          : /已付款|已成团|确认收货/.test(order.statusText || "")
                          ? "bg-blue-50 text-blue-600"
                          : /待付款/.test(order.statusText || "")
                          ? "bg-yellow-50 text-yellow-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {order.statusText}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{order.skuName}</p>
                  <div className="mt-2.5 flex justify-between items-center text-sm">
                    <span className="text-gray-400 text-xs">¥{order.price} × {order.skuNum}</span>
                    <div className="text-right">
                      <span className="text-orange-500 font-semibold">
                        返利: ¥{(order.userActualFee || order.userEstimateFee || 0).toFixed(2)}
                      </span>
                      {order.userActualFee === 0 && (order.userEstimateFee ?? 0) > 0 && (
                        <span className="text-xs text-gray-400 ml-1">(预估)</span>
                      )}
                    </div>
                  </div>
                  {order.failReason && (
                    <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-600">{order.failReason}</p>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                    <span className="text-xs text-gray-400">{order.orderTime}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Withdraw Button */}
      <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
        <p className="text-sm text-gray-500 mb-3">确认收货结算后，添加企业微信申请提现</p>
        <a
          href="https://work.weixin.qq.com/ca/cawcde6e963de37ac0"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3.5 rounded-2xl font-semibold text-base active:opacity-90 transition-opacity shadow-sm shadow-green-200"
        >
          添加企业微信提现
        </a>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">查询说明</h4>
        <ul className="space-y-1.5 text-xs text-blue-700 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-blue-300 flex-shrink-0 mt-0.5">●</span>
            <span>请先选择对应平台，再输入该平台的订单号</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-300 flex-shrink-0 mt-0.5">●</span>
            <span>仅可查询通过推广链接下单的订单</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-300 flex-shrink-0 mt-0.5">●</span>
            <span>订单号可在{platformAppName[orderPlatform]}APP「我的订单」中查看</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-300 flex-shrink-0 mt-0.5">●</span>
            <span>确认收货后结算可提现，最终以实际结算为准</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-300 flex-shrink-0 mt-0.5">●</span>
            <span>提现请添加企业微信，发送订单号即可</span>
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 pt-10 pb-5">
        <div className="flex items-center justify-center gap-2.5 mb-1">
          <img src="/logo.jpg" alt="省钱Go" className="w-10 h-10 rounded-xl shadow-sm" />
          <h1 className="text-2xl font-bold tracking-wide">省钱Go</h1>
        </div>
        <p className="text-center text-sm opacity-90">购物返利，省钱到手</p>
      </div>

      {/* Tabs - plain div, no nesting, inline styles for reliable mobile taps */}
      <div
        style={{
          display: "flex",
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab("convert")}
          style={{
            flex: 1,
            padding: "14px 0",
            textAlign: "center",
            fontSize: 14,
            fontWeight: 500,
            color: activeTab === "convert" ? "#ef4444" : "#9ca3af",
            borderBottom: activeTab === "convert" ? "2px solid #ef4444" : "2px solid transparent",
            cursor: "pointer",
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          生成链接
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab("orders")}
          style={{
            flex: 1,
            padding: "14px 0",
            textAlign: "center",
            fontSize: 14,
            fontWeight: 500,
            color: activeTab === "orders" ? "#ef4444" : "#9ca3af",
            borderBottom: activeTab === "orders" ? "2px solid #ef4444" : "2px solid transparent",
            cursor: "pointer",
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          查询提现
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5">
        {activeTab === "convert" ? renderConvertTab() : renderOrdersTab()}
      </div>

      <div className="text-center text-xs text-gray-300 py-6">
        省钱Go · 购物更实惠
      </div>

      {promotingSign && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <Spinner className="h-10 w-10 text-white" />
          <p className="mt-4 text-white text-base font-medium">正在跳转拼多多...</p>
        </div>
      )}
    </div>
  );
}
