#include <stdio.h>
#include <stdlib.h>
#include <limits.h>



static inline int maximum(int a, int b)
{
    return a > b ? a : b;
}

static int dfs(struct TreeNode *root, int *max)
{
    if (root == NULL) {
        return 0;
    }

    /* In case of negative node value */
    int subl = maximum(dfs(root->left, max), 0);
    int subr = maximum(dfs(root->right, max), 0);

    int sum = root->val + subl + subr;
    if (sum > *max) {
       *max = sum;
    }

    /* The return value does not equal the sum value
     * since we need to return path through the root node
     */
    return root->val + maximum(subl, subr);
}

static int maxPathSum(struct TreeNode* root)
{
    int max = INT_MIN;
    dfs(root, &max);
    return max;
}
