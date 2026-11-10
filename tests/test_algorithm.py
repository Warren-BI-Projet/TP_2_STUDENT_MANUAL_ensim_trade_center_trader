import unittest

from scripts.algorithm import compute_signal, guarded_signal, produce


class TradingTests(unittest.TestCase):
    def test_signal_requires_history_and_confirmation(self):
        self.assertEqual(compute_signal([]), 0)
        self.assertGreater(compute_signal([100 + i for i in range(20)]), 0)
        self.assertLess(compute_signal([120 - i for i in range(20)]), 0)
        self.assertLessEqual(abs(compute_signal([100 + i for i in range(20)])), 0.3)

    def test_risk_guards_cash_inventory_and_concentration(self):
        self.assertEqual(guarded_signal(0.3, 50, 0, 10, 1000), 0)
        self.assertEqual(guarded_signal(-0.3, 50, 4, 10, 1000), -0.04)
        self.assertEqual(guarded_signal(0.3, 1000, 30, 10, 1000), 0)

    def test_multiple_buys_share_one_budget(self):
        market = {"products": ["A", "B", "C"], "history": [
            {"t": i + 1, "timestamp": "2026-01-01T00:00:00Z",
             "A": 100 + i, "B": 100 + i, "C": 100 + i} for i in range(20)]}
        holdings = {"money": 100, "products": {"A": 0, "B": 0, "C": 0}}
        decision, _ = produce(market, holdings, {"leaderboard": []})
        spent = sum(decision[p] * 100 * 119 for p in "ABC")
        self.assertLessEqual(spent, 50)


if __name__ == "__main__":
    unittest.main()
