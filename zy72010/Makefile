.PHONY: install demo test clean

install:
	pip install -r requirements.txt

demo:
	cd src && python -m vip_reconcile.cli demo

run-sample:
	cd src && python -m vip_reconcile.cli run \
		-v ../samples/voucher_list.csv \
		-e ../samples/ \
		-a ../samples/attachment_index.csv \
		--operator 小孟

test:
	python -m pytest tests/ -v

clean:
	rm -rf output/
	rm -f .reconcile_state.pkl
	rm -f src/.reconcile_state.pkl
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
