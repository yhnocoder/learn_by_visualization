**从一个变量到多个变量。** 一元函数 $h = f(z)$，导数 $f'(z)$ 是一个数，含义是：$z$ 动一点点 $\Delta z$，$h$ 就动 $f'(z)\,\Delta z$。

现在 $z$ 是 $d_{ff}$ 维向量，$h$ 也是 $d_{ff}$ 维向量。"$z$ 动一点点"就有 $d_{ff}$ 个方向可以动，"$h$ 跟着动"也有 $d_{ff}$ 个分量在动。要描述完整的关系，需要回答 $d_{ff}\times d_{ff}$ 个问题：**第 $j$ 个输入 $z_j$ 动一点，第 $i$ 个输出 $h_i$ 跟着动多少？** 这个答案就是偏导数 $\partial h_i/\partial z_j$。

把这些偏导数排成一个矩阵，第 $i$ 行第 $j$ 列放 $\partial h_i/\partial z_j$，这个矩阵就叫 **Jacobian**，记作 $J$，$J_{ij}$ 就是它第 $i$ 行第 $j$ 列的那个数：

$$J = \begin{pmatrix} \dfrac{\partial h_1}{\partial z_1} & \dfrac{\partial h_1}{\partial z_2} & \cdots \\[8pt] \dfrac{\partial h_2}{\partial z_1} & \dfrac{\partial h_2}{\partial z_2} & \cdots \\[4pt] \vdots & \vdots & \ddots \end{pmatrix}, \qquad J_{ij} = \frac{\partial h_i}{\partial z_j}.$$

一行对应一个输出 $h_i$，这一行记录了它对每个输入的敏感程度；一列对应一个输入 $z_j$，这一列记录了它牵动每个输出的程度。Jacobian 就是"向量对向量的导数"，是一元导数在多维下的直接推广。

**反向传播为什么要乘它。** 我们要的是 $\partial L/\partial z_j$：loss 对第 $j$ 个输入的敏感程度。$z_j$ 不直接影响 $L$，它先影响 $h_1, h_2, \dots$，再由这些 $h_i$ 影响 $L$。所以 $z_j$ 动一点对 $L$ 的总影响，要把所有路径加起来：

$$\frac{\partial L}{\partial z_j} = \sum_{i} \frac{\partial L}{\partial h_i}\cdot\frac{\partial h_i}{\partial z_j} = \sum_i \frac{\partial L}{\partial h_i}\, J_{ij}.$$

每条路径是"$z_j \to h_i \to L$"，贡献是两段导数相乘。把这个求和看成矩阵运算，就是行向量 $\partial L/\partial h$ 乘上矩阵 $J$。这就是链式法则在向量情形下的形式。

